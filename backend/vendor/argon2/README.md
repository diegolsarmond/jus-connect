# Argon2 local fallback

This repository vendors a lightweight JavaScript implementation of the Argon2 API
so that environments without access to the public npm registry can still install
and run the backend. It mirrors the high level surface of the real `argon2`
package by delegating to a deterministic scrypt-based fallback.
