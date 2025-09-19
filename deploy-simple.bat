@echo off
echo Building project...
call npm run build

echo.
echo Copying files to root for GitHub Pages...
if exist docs rmdir /s /q docs
mkdir docs
xcopy /e /i dist docs

echo.
echo ✅ Deployment ready!
echo.
echo To deploy:
echo 1. Commit and push these changes
echo 2. Go to GitHub repository Settings → Pages
echo 3. Set Source to "Deploy from a branch"
echo 4. Set Branch to "main" and folder to "/docs"
echo.
echo Files in docs folder:
dir docs
pause
