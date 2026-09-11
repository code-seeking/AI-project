@echo off
cd /d D:\acme\AI-project
"C:\Program Files\Git\cmd\git.exe" add -A
echo === ADD DONE === > D:\acme\AI-project\git-log.txt
"C:\Program Files\Git\cmd\git.exe" status --short >> D:\acme\AI-project\git-log.txt
echo === STATUS DONE === >> D:\acme\AI-project\git-log.txt
"C:\Program Files\Git\cmd\git.exe" commit -m "feat: fix section numbering, enhance concept explanations, add Mermaid diagrams and tables" >> D:\acme\AI-project\git-log.txt
echo === COMMIT DONE === >> D:\acme\AI-project\git-log.txt
"C:\Program Files\Git\cmd\git.exe" push origin main >> D:\acme\AI-project\git-log.txt
echo === PUSH DONE === >> D:\acme\AI-project\git-log.txt
