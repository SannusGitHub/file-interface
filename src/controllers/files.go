package controllers

import (
	"fmt"
	"image"
	"image/jpeg"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"golang.org/x/image/draw"
)

func CreateFile(fileName string, dir string) (*os.File, error) {
	dir = filepath.Clean(dir)
	if filepath.IsAbs(dir) || strings.HasPrefix(dir, "..") {
		return nil, fmt.Errorf("invalid directory: %s", dir)
	}

	dst, err := os.Create("./" + dir + "/" + fileName)
	if err != nil {
		return nil, err
	}
	return dst, nil
}

func DeleteFile(dir string) error {
	dir = filepath.Clean(dir)
	if filepath.IsAbs(dir) || strings.HasPrefix(dir, "..") {
		return fmt.Errorf("invalid directory: %s", dir)
	}

	e := os.Remove(dir)
	if e != nil {
		return fmt.Errorf("could not remove file: %s", dir)
	}

	return nil
}

const thumbSize = 300 // max width or height in pixels

var videoExtensions = map[string]bool{
	".mp4": true, ".mkv": true, ".avi": true, ".mov": true, ".webm": true,
}

var imageExtensions = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true,
}

func GetThumbnail(filePath string) string {
	ext := strings.ToLower(filepath.Ext(filePath))

	thumbPath := thumbPath(filePath)

	if _, err := os.Stat(thumbPath); err == nil {
		return thumbPath
	}

	if err := os.MkdirAll(filepath.Dir(thumbPath), 0755); err != nil {
		return ""
	}

	if videoExtensions[ext] {
		return generateVideoThumbnail(filePath, thumbPath)
	} else if imageExtensions[ext] {
		return generateImageThumbnail(filePath, thumbPath)
	}

	return ""
}

func thumbPath(filePath string) string {
	dir := filepath.Dir(filePath)
	base := filepath.Base(filePath)
	return filepath.Join(dir, ".thumbs", base+".jpg")
}

func generateVideoThumbnail(videoPath, thumbPath string) string {
	cmd := exec.Command("ffmpeg",
		"-ss", "00:00:01",
		"-i", videoPath,
		"-vframes", "1",
		"-vf", fmt.Sprintf("scale=%d:%d:force_original_aspect_ratio=decrease", thumbSize, thumbSize),
		"-q:v", "2",
		thumbPath,
	)
	if err := cmd.Run(); err != nil {
		return ""
	}
	return thumbPath
}

func generateImageThumbnail(imagePath, thumbPath string) string {
	f, err := os.Open(imagePath)
	if err != nil {
		return ""
	}
	defer f.Close()

	src, _, err := image.Decode(f)
	if err != nil {
		return ""
	}

	resized := resizeImage(src, thumbSize)

	out, err := os.Create(thumbPath)
	if err != nil {
		return ""
	}
	defer out.Close()

	if err := jpeg.Encode(out, resized, &jpeg.Options{Quality: 85}); err != nil {
		return ""
	}

	return thumbPath
}

func resizeImage(src image.Image, maxSide int) image.Image {
	bounds := src.Bounds()
	w, h := bounds.Dx(), bounds.Dy()

	if w <= maxSide && h <= maxSide {
		return src
	}

	var newW, newH int
	if w > h {
		newW = maxSide
		newH = (h * maxSide) / w
	} else {
		newH = maxSide
		newW = (w * maxSide) / h
	}

	dst := image.NewRGBA(image.Rect(0, 0, newW, newH))
	draw.BiLinear.Scale(dst, dst.Bounds(), src, src.Bounds(), draw.Over, nil)
	return dst
}
