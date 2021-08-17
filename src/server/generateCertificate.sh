#!/usr/bin/env bash

#
# Used https://github.com/gitphill/openssl-alpine by pgarrett as reference
#
# Useful online tool for testing: https://certificatetools.com/
#

# Default variables for generating test certificate
export COUNTY="UK"
export STATE="Greater London"
export LOCATION="London"
export ORGANISATION="Speed Testers"
export ROOT_CN="Root"
export ISSUER_CN="Speed Testers Ltd"
export PUBLIC_CN="*.speedtestanalyzer.com"
export ISSUER_NAME="speedtest_analyzer_admins"
export SERVER="speedtest_analyzer_server"
export PUBLIC_NAME="public"
export RSA_KEY_NUMBITS="4096"
export DAYS="365"
export KEYSTORE_NAME="keystore"
export KEYSTORE_PASS="changeit"

SUBJ="/C=$COUNTY/ST=$STATE/L=$LOCATION/O=$ORGANISATION"

mkdir -p "$SSL_CERTIFICATE_ROOT" && chmod 600 "$SSL_CERTIFICATE_ROOT"

if [ ! -f "$SSL_CERTIFICATE_ROOT/$SSL_ROOT_NAME.crt" ]; then
    # generate root certificate
    ROOT_SUBJ="$SUBJ/CN=$ROOT_CN"

    echo " ---> Generate Root CA private key: '$SSL_CERTIFICATE_ROOT/$SSL_ROOT_NAME.key'"
    openssl genrsa \
        -out "$SSL_CERTIFICATE_ROOT/$SSL_ROOT_NAME.key" \
        "$RSA_KEY_NUMBITS"

    echo " ---> Generate Root CA certificate request: '$SSL_CERTIFICATE_ROOT/$SSL_ROOT_NAME.csr'"
    openssl req \
        -new \
        -key "$SSL_CERTIFICATE_ROOT/$SSL_ROOT_NAME.key" \
        -out "$SSL_CERTIFICATE_ROOT/$SSL_ROOT_NAME.csr" \
        -subj "$ROOT_SUBJ"

    echo " ---> Generate self-signed Root CA certificate: '$SSL_CERTIFICATE_ROOT/$SSL_ROOT_NAME.crt'"
    openssl req \
        -x509 \
        -key "$SSL_CERTIFICATE_ROOT/$SSL_ROOT_NAME.key" \
        -in "$SSL_CERTIFICATE_ROOT/$SSL_ROOT_NAME.csr" \
        -out "$SSL_CERTIFICATE_ROOT/$SSL_ROOT_NAME.crt" \
        -days "$DAYS"
else
    echo "Certificate Generator: '$SSL_ROOT_NAME.crt' already exists"
fi

if [ ! -f "$SSL_CERTIFICATE_ROOT/$ISSUER_NAME.crt" ]; then
    # generate issuer certificate
    ISSUER_SUBJ="$SUBJ/CN=$ISSUER_CN"

    echo " ---> Generate Issuer private key: '$SSL_CERTIFICATE_ROOT/$ISSUER_NAME.key'"
    openssl genrsa \
        -out "$SSL_CERTIFICATE_ROOT/$ISSUER_NAME.key" \
        "$RSA_KEY_NUMBITS"

    echo " ---> Generate Issuer certificate request: '$SSL_CERTIFICATE_ROOT/$ISSUER_NAME.csr'"
    openssl req \
        -new \
        -key "$SSL_CERTIFICATE_ROOT/$ISSUER_NAME.key" \
        -out "$SSL_CERTIFICATE_ROOT/$ISSUER_NAME.csr" \
        -subj "$ISSUER_SUBJ"

    echo " ---> Generate Issuer certificate: '$SSL_CERTIFICATE_ROOT/$ISSUER_NAME.crt'"

    # https://github.com/gitphill/openssl-alpine/blob/master/issuer.ext
    printf "basicConstraints = critical,CA:true\n" >"$SSL_CERTIFICATE_ROOT/issuer.ext"
    printf "keyUsage = critical,keyCertSign\n" >>"$SSL_CERTIFICATE_ROOT/issuer.ext"
    printf "[SAN]\nsubjectAltName=DNS:$SERVER\n" >"$SSL_CERTIFICATE_ROOT/issuer.ext"

    openssl x509 \
        -req \
        -in "$SSL_CERTIFICATE_ROOT/$ISSUER_NAME.csr" \
        -CA "$SSL_CERTIFICATE_ROOT/$SSL_ROOT_NAME.crt" \
        -CAkey "$SSL_CERTIFICATE_ROOT/$SSL_ROOT_NAME.key" \
        -out "$SSL_CERTIFICATE_ROOT/$ISSUER_NAME.crt" \
        -CAcreateserial \
        -extfile "$SSL_CERTIFICATE_ROOT/issuer.ext" \
        -days "$DAYS"
else
    echo "Certificate Generator: '$ISSUER_NAME.crt' already exists"
fi

if [ ! -f "$SSL_CERTIFICATE_ROOT/$PUBLIC_NAME.key" ]; then
    # generate public rsa key
    echo " ---> Generate private key"
    openssl genrsa \
        -out "$SSL_CERTIFICATE_ROOT/$PUBLIC_NAME.key" \
        "$RSA_KEY_NUMBITS"
else
    echo "Certificate Generator: '$PUBLIC_NAME.key' already exists"
fi

if [ ! -f "$SSL_CERTIFICATE_ROOT/$PUBLIC_NAME.crt" ]; then
    # generate public certificate
    echo " ---> Generate public certificate request"
    PUBLIC_SUBJ="$SUBJ/CN=$PUBLIC_CN"
    openssl req \
        -new \
        -key "$SSL_CERTIFICATE_ROOT/$PUBLIC_NAME.key" \
        -out "$SSL_CERTIFICATE_ROOT/$PUBLIC_NAME.csr" \
        -subj "$PUBLIC_SUBJ"

    # https://github.com/gitphill/openssl-alpine/blob/master/public.ext
    printf "extendedKeyUsage = serverAuth,clientAuth\n" >"$SSL_CERTIFICATE_ROOT/public.ext"
    printf "subjectAltName = @alt_names\n\n" >>"$SSL_CERTIFICATE_ROOT/public.ext"
    printf "[alt_names]\n" >>"$SSL_CERTIFICATE_ROOT/public.ext"
    printf "DNS.1 = $PUBLIC_CN\n" >>"$SSL_CERTIFICATE_ROOT/public.ext"

    echo " ---> Generate public certificate signed by $ISSUER_CN"
    openssl x509 \
        -req \
        -in "$SSL_CERTIFICATE_ROOT/$PUBLIC_NAME.csr" \
        -CA "$SSL_CERTIFICATE_ROOT/$ISSUER_NAME.crt" \
        -CAkey "$SSL_CERTIFICATE_ROOT/$ISSUER_NAME.key" \
        -out "$SSL_CERTIFICATE_ROOT/$PUBLIC_NAME.crt" \
        -CAcreateserial \
        -extfile "$SSL_CERTIFICATE_ROOT/public.ext" \
        -days "$DAYS"
else
    echo "Certificate Generator: '$PUBLIC_NAME.crt' already exists"
fi

if [ ! -f "$SSL_CERTIFICATE_ROOT/ca.pem" ]; then
    # make combined root and issuer ca.pem
    echo " ---> Generate a combined root and issuer: '$SSL_CERTIFICATE_ROOT/ca.pem'"
    cat "$SSL_CERTIFICATE_ROOT/$ISSUER_NAME.crt" "$SSL_CERTIFICATE_ROOT/$SSL_ROOT_NAME.crt" >"$SSL_CERTIFICATE_ROOT/ca.pem"
else
    echo "Certificate Generator: 'ca.pem' already exists"
fi

if [ ! -f "$SSL_CERTIFICATE_ROOT/$KEYSTORE_NAME.pfx" ]; then
    # make PKCS12 keystore
    echo " ---> Generate keystore: '$SSL_CERTIFICATE_ROOT/$KEYSTORE_NAME.pfx'"
    openssl pkcs12 \
        -export \
        -in "$SSL_CERTIFICATE_ROOT/$PUBLIC_NAME.crt" \
        -inkey "$SSL_CERTIFICATE_ROOT/$PUBLIC_NAME.key" \
        -certfile "$SSL_CERTIFICATE_ROOT/ca.pem" \
        -password "pass:$KEYSTORE_PASS" \
        -out "$SSL_CERTIFICATE_ROOT/$KEYSTORE_NAME.pfx"
else
    echo "Certificate Generator: '$KEYSTORE_NAME.pfx' already exists"
fi
