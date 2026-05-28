package main

import (
	handlers "file-interface/src"
	"fmt"
	"log"
	"net/http"
)

func main() {
	fmt.Println("Starting server...")

	handlers.SetupPage()

	err := http.ListenAndServe("127.0.0.1:1759", nil)
	if err != nil {
		log.Fatal(err)
	}
}
