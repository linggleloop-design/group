#!/usr/bin/env python3
"""Local compile server for the group website LaTeX editor.

Run from this repository root:
    python3 tools/local_compile_server.py

Then open:
    http://127.0.0.1:8123/latex.html?project=<name>

The editor will send the current project to POST /compile, which runs xelatex
on this machine and returns the finished PDF. Nothing is uploaded to the
public internet.
"""

import base64
import json
import os
import shutil
import subprocess
import tempfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        pass

    def do_POST(self):
        if self.path.rstrip("/") != "/compile":
            self.send_error(404, "Not found")
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
        except Exception as exc:
            self.send_error(400, f"Invalid request: {exc}")
            return

        main = str(payload.get("main") or "main.tex")
        files = payload.get("files") or []
        workdir = tempfile.mkdtemp(prefix="group_latex_compile_")

        try:
            for item in files:
                rel = str(item.get("path") or "")
                if (
                    not rel
                    or rel.startswith("/")
                    or ".." in rel.split("/")
                ):
                    continue
                data = item.get("data", "")
                if item.get("encoding") == "base64":
                    content = base64.b64decode(data)
                else:
                    content = str(data).encode("utf-8")
                full = os.path.realpath(os.path.join(workdir, rel))
                if not full.startswith(os.path.realpath(workdir) + os.sep):
                    continue
                os.makedirs(os.path.dirname(full), exist_ok=True)
                with open(full, "wb") as fh:
                    fh.write(content)

            tex = shutil.which("xelatex")
            if not tex:
                self.send_error(500, "xelatex not found on this machine")
                return

            cmd = [tex, "-interaction=nonstopmode", main]
            logs = []
            for _ in range(2):
                proc = subprocess.run(
                    cmd,
                    cwd=workdir,
                    capture_output=True,
                    text=True,
                )
                logs.append(proc.stdout + proc.stderr)

            pdf_name = os.path.splitext(main)[0] + ".pdf"
            pdf_path = os.path.join(workdir, pdf_name)
            if os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 1024:
                with open(pdf_path, "rb") as fh:
                    pdf = fh.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/pdf")
                self.send_header("Content-Length", str(len(pdf)))
                self.end_headers()
                self.wfile.write(pdf)
                return

            log_path = os.path.join(workdir, os.path.splitext(main)[0] + ".log")
            if os.path.exists(log_path):
                with open(log_path, "rb") as fh:
                    log_text = fh.read().decode("utf-8", errors="replace")
            else:
                log_text = "\n\n===== pass 2 =====\n\n".join(logs)
            body = log_text.encode("utf-8")
            self.send_response(422)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        finally:
            shutil.rmtree(workdir, ignore_errors=True)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8123"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Serving {ROOT} at http://127.0.0.1:{port}")
    server.serve_forever()
