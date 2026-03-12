' Grades Server - Hidden Startup Script
' This script starts the Node.js grades server in the background
' No console window will be shown

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get the directory where this script is located
scriptPath = fso.GetParentFolderName(WScript.ScriptFullName)
nodeExe = "node"
localNode = "C:\Program Files\nodejs\node.exe"

' Change to the script directory
WshShell.CurrentDirectory = scriptPath

If fso.FileExists(localNode) Then
	nodeExe = """" & localNode & """"
End If

' Start the node server hidden (0 = hidden, False = don't wait)
WshShell.Run nodeExe & " """ & scriptPath & "\grades-server.js""", 0, False

' Optional: Log startup
' Set logFile = fso.OpenTextFile(scriptPath & "\startup-log.txt", 8, True)
' logFile.WriteLine Now() & " - Server started"
' logFile.Close
