$root = "C:\Users\steven\Downloads\nuevoproyectooxidian"

Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$root\\backend'; if (Test-Path .venv\\Scripts\\python.exe) { .\\.venv\\Scripts\\python.exe run.py } else { python run.py }"
)

Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$root\\frontend'; npm run dev"
)

