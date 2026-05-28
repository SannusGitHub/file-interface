package handlers

import (
	"encoding/json"
	"file-interface/src/controllers"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func SetupPage() {
	handleIndex()
	handleFiles()
}

func handleIndex() {
	http.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("static"))))
	http.HandleFunc("/", func(writer http.ResponseWriter, request *http.Request) {
		http.ServeFile(writer, request, "index.html")
	})
}

type fileDataStruct struct {
	Name      string `json:"name"`
	Path      string `json:"path"`
	IsDir     bool   `json:"isdir"`
	ThumbPath string `json:"thumbpath"`
}

type dirRequestStruct struct {
	DirRequest string `json:"dirRequest"`
}

type metaRequestStruct struct {
	Path string `json:"path"`
}

type metaResponseStruct struct {
	Size    int64  `json:"size"`
	ModTime string `json:"modtime"`
}

func handleFiles() {
	http.HandleFunc("/filestorage/", func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path == "/filestorage" || request.URL.Path == "/filestorage/" || strings.HasSuffix(request.URL.Path, "/") {
			http.NotFound(writer, request)
			return
		}

		path := filepath.Join("filestorage", filepath.Clean(strings.TrimPrefix(request.URL.Path, "/filestorage/")))

		info, err := os.Stat(path)
		if err != nil || info.IsDir() {
			http.NotFound(writer, request)
			return
		}

		http.ServeFile(writer, request, path)
	})

	// query all the files
	http.HandleFunc("/list", func(writer http.ResponseWriter, request *http.Request) {
		var directoryRequested dirRequestStruct
		err := json.NewDecoder(request.Body).Decode(&directoryRequested)
		if err != nil {
			http.Error(writer, "Invalid request", http.StatusBadRequest)
			return
		}

		baseFilePath := "./" + directoryRequested.DirRequest
		dir, err := os.Open(baseFilePath)
		if err != nil {
			fmt.Println("Error opening dir", err)
			return
		}
		defer dir.Close()

		files, err := dir.Readdir(0)
		if err != nil {
			fmt.Println("Error reading dir", err)
			return
		}

		var storedFiles []fileDataStruct
		for _, value := range files {
			if strings.HasPrefix(value.Name(), ".") {
				continue
			}

			filePath := filepath.Join(baseFilePath, value.Name())
			file := fileDataStruct{
				Name:  value.Name(),
				Path:  filePath,
				IsDir: value.IsDir(),
			}

			if !value.IsDir() {
				file.ThumbPath = controllers.GetThumbnail(filePath)
			}

			storedFiles = append(storedFiles, file)
		}

		writer.Header().Set("Content-Type", "application/json")
		json.NewEncoder(writer).Encode(storedFiles)
	})

	// uploading
	http.HandleFunc("/upload", func(writer http.ResponseWriter, request *http.Request) {
		request.ParseMultipartForm(10 << 20)

		targetDir := request.FormValue("uploadDirectory")
		if targetDir == "" {
			targetDir = "filestorage"
		}

		for _, fileHeader := range request.MultipartForm.File["uploadFileForm"] {
			uploadedFile, err := fileHeader.Open()
			if err != nil {
				http.Error(writer, "Error opening uploaded file", http.StatusBadRequest)
				return
			}
			defer uploadedFile.Close()

			dst, err := controllers.CreateFile(fileHeader.Filename, targetDir)
			if err != nil {
				fmt.Println(err)
				http.Error(writer, "Error creating destination file", http.StatusInternalServerError)
				return
			}
			defer dst.Close()

			if _, err := io.Copy(dst, uploadedFile); err != nil {
				http.Error(writer, "Error saving the file", http.StatusInternalServerError)
				return
			}
		}

		writer.WriteHeader(http.StatusOK)
		// http.Redirect(writer, request, request.Header.Get("Referer"), http.StatusFound)
	})

	// meta
	http.HandleFunc("/meta", func(writer http.ResponseWriter, request *http.Request) {
		var req metaRequestStruct

		if err := json.NewDecoder(request.Body).Decode(&req); err != nil {
			http.Error(writer, "Invalid request", http.StatusBadRequest)
			return
		}

		clean := filepath.Clean(req.Path)
		rel, err := filepath.Rel("filestorage", clean)
		if err != nil || strings.HasPrefix(rel, "..") {
			http.Error(writer, "Forbidden", http.StatusForbidden)
			return
		}

		info, err := os.Stat(clean)
		if err != nil {
			http.Error(writer, "Not found", http.StatusNotFound)
			return
		}

		writer.Header().Set("Content-Type", "application/json")
		json.NewEncoder(writer).Encode(metaResponseStruct{
			Size:    info.Size(),
			ModTime: info.ModTime().Format("2006-01-02 15:04"),
		})
	})
}
