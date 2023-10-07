# Semantic Commit Messages

Berikut adalah cara commit dengan pesan yang jelas.

Format: `<tipe>(<scope>): <subjek>`

`<scope>` adalah opsional

## Contoh

```
feat: tambah mockup beranda
^--^  ^-------------^
|     |
|     +-> Ringkasan menggunakan kata kerja tunggal ("tambah", bukan "ditambahkan").
|
+-------> Tipe: chore, docs, feat, fix, refactor, style, test.
```

Contoh Lain:

- `feat`: (fitur baru untuk pengguna, bukan fitur baru untuk script)
- `fix`: (perbaikan bug untuk pengguna, bukan perbaikan bug untuk script)
- `docs`: (perubahan pada dokumentasi)
- `style`: (formatting, lupa semicolon, etc; bukan perubahan pada kode)
- `refactor`: (refaktor kode, contoh: mengubah nama sebuah variabel)
- `test`: (nambahin test yang kurang, refaktor test, tidak ada kode yang diubah)
- `chore`: (bersih-bersih kode, hapus comment, hapus kode tidak terpakai, tidak mengubah kode yang terpakai)

Refrensi:

- https://www.conventionalcommits.org/
- https://seesparkbox.com/foundry/semantic_commit_messages
- http://karma-runner.github.io/1.0/dev/git-commit-msg.html
