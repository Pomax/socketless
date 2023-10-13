I generated these with `mkcert` from https://github.com/FiloSottile/mkcert

```
./cert> mkcert -install
./cert> mkcert localhost
./cert> mkcert -CAROOT
```

This last instruction prints the root ca location which you will need
to add to your browser's list of certificate authorities.

In Firefox: open settings, type "certificates", click "view certificates",
then the "authorities" tab, and click "import". Import the certificate
`pem` file (not the key) and you should be good to go.
