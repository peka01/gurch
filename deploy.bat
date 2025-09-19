@echo off
echo Building project...
call npm run build

echo.
echo Preparing deployment files...
if exist deploy rmdir /s /q deploy
mkdir deploy
xcopy /e /i dist deploy

echo.
echo 🚀 Deployment ready!
echo.
echo To deploy to GitHub Pages:
echo 1. Copy all files from the 'deploy' folder
echo 2. Go to your GitHub repository: https://github.com/peka01/gurch2
echo 3. Upload all files to the root of the repository
echo 4. Or use: git add . ^&^& git commit -m "Deploy" ^&^& git push
echo.
echo Files to deploy:
dir deploy
pause
