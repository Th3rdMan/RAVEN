#!/usr/bin/env python3
import socket
import json
import base64

HOST = "57.128.112.118"
PORT = 1337


def ask_vera(message: str) -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect((HOST, PORT))
    s.settimeout(30)

    body = json.dumps({"message": message}).encode()
    req = (
        f"POST /chat HTTP/1.1\r\n"
        f"Host: {HOST}:{PORT}\r\n"
        f"Content-Type: application/json\r\n"
        f"Content-Length: {len(body)}\r\n"
        f"Connection: close\r\n\r\n"
    ).encode() + body
    s.sendall(req)

    data = b""
    try:
        while True:
            chunk = s.recv(8192)
            if not chunk:
                break
            data += chunk
    except socket.timeout:
        pass
    finally:
        s.close()

    if b"\r\n\r\n" not in data:
        raise ValueError("Invalid HTTP response")

    body_bytes = data.split(b"\r\n\r\n", 1)[1]
    parsed = json.loads(body_bytes)

    if parsed.get("error"):
        return f"[Erreur] {parsed['error']}"

    reply_b64 = parsed.get("reply", "")
    if not reply_b64:
        return "[Pas de réponse]"

    return base64.b64decode(reply_b64).decode("utf-8")


def main():
    print("=" * 50)
    print("  V.E.R.A — APT-Get Internal AI")
    print(f"  {HOST}:{PORT}")
    print("=" * 50)
    print("Tapez 'exit' pour quitter.\n")

    welcome = ask_vera("Bonjour")
    print(f"V.E.R.A: {welcome}\n")

    while True:
        try:
            user_input = input("Vous: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nAu revoir.")
            break

        if not user_input:
            continue
        if user_input.lower() in ("exit", "quit", "q"):
            print("Au revoir.")
            break

        try:
            reply = ask_vera(user_input)
            print(f"V.E.R.A: {reply}\n")
        except Exception as e:
            print(f"[Erreur réseau] {e}\n")


if __name__ == "__main__":
    main()
