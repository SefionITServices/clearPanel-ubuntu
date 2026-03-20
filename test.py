import sys
import subprocess

def run_build():
    result = subprocess.run("cd frontend && npm run dev > /tmp/npm_dev.log 2>&1 & sleep 10 && cat /tmp/npm_dev.log", shell=True, capture_output=True, text=True)
    return result.stdout

if __name__ == "__main__":
    out = run_build()
    print(out[:1000])
