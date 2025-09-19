#!/bin/bash

# Build the project
echo "Building project..."
npm run build

# Copy dist contents to a temporary directory
echo "Preparing deployment files..."
mkdir -p deploy
cp -r dist/* deploy/

# Instructions for manual deployment
echo ""
echo "🚀 Deployment ready!"
echo ""
echo "To deploy to GitHub Pages:"
echo "1. Copy all files from the 'deploy' folder"
echo "2. Go to your GitHub repository: https://github.com/peka01/gurch2"
echo "3. Upload all files to the root of the repository"
echo "4. Or use: git add . && git commit -m 'Deploy' && git push"
echo ""
echo "Files to deploy:"
ls -la deploy/
