@echo off
echo Starting Trackquet backend...
cd /d %~dp0backend
go run main.go
