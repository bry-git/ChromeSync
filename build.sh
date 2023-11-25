#!/bin/bash

function show_help() {
  echo
  echo "ChromeSync build system"
  echo
  echo "Usage: "
  echo "  ./build.sh <OPTIONS>"
  echo
  echo "  --get-client            copy the ChromeSync client from container to .build/"
  echo "  --hostname  <HOSTNAME>  build the container and client where the client points to hostname arg"
  echo "  --clean                 remove the deployment of ChromeSync from docker and build dir"
}

function exit_with_failure(){
  local message="$1"
  echo "ERROR: ${message}"
  exit 1
}

function check_deps(){
  which docker > /dev/null || exit_with_failure "docker not installed"
  which openssl > /dev/null || exit_with_failure "openssl not installed"
  which shasum > /dev/null || exit_with_failure "shasum not installed"
  #which xxd > /dev/null || exit_with_failure "xxd not installed"
}

function create_container() {
  local HOSTNAME="$1"
  local API_KEY=$(openssl rand -base64 32)

  docker build \
      --build-arg API_KEY="$API_KEY" \
      --build-arg HOSTNAME="$HOSTNAME" \
      -t chrome-sync:latest .

  docker run \
      -d \
      --name chrome-sync \
      --publish 443:443 \
      chrome-sync:latest
}

function generate_extentsion_keys(){
  # these are to allow packaging of the extension
  # the keys do not really matter since this extension is not
  # for publishing on chrome store
  # generate private key
  openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out key.pem
  # generate public key
  openssl rsa -in key.pem -pubout -outform DER | openssl base64 -A
  # generate extension id from public key
  openssl rsa -in key.pem -pubout -outform DER | shasum -a 256 | head -c32 | tr 0-9a-f a-p
}

function package_client(){
  # https://stackoverflow.com/questions/18693962/pack-chrome-extension-on-server-with-only-command-line-interface

  # Purpose: Pack a Chromium extension directory into crx format
  dir=build
  key=key.pem
  name="ChromeSync"
  crx="$name.crx"
  pub="$name.pub"
  sig="$name.sig"
  zip="$name.zip"
  tosign="$name.presig"
  binary_crx_id="$name.crxid"

  # zip up the crx dir
  cwd=$(pwd -P)
  (cd "$dir" && zip -qr -9 -X "$cwd/$zip" .)

  #extract crx id
  openssl rsa -in "$key" -pubout -outform der | openssl dgst -sha256 -binary -out "$binary_crx_id"
  truncate -s 16 "$binary_crx_id"

  #generate file to sign
  (
    # echo "$crmagic_hex $version_hex $header_length $pub_len_hex $sig_len_hex"
    printf "CRX3 SignedData"
    echo "00 12 00 00 00 0A 10" | xxd -r -p
    cat "$binary_crx_id" "$zip"
  ) > "$tosign"

  # signature
  openssl dgst -sha256 -binary -sign "$key" < "$tosign" > "$sig"

  # public key
  openssl rsa -pubout -outform DER < "$key" > "$pub" 2>/dev/null


  crmagic_hex="43 72 32 34" # Cr24
  version_hex="03 00 00 00" # 3
  header_length="45 02 00 00"
  header_chunk_1="12 AC 04 0A A6 02"
  header_chunk_2="12 80 02"
  header_chunk_3="82 F1 04 12 0A 10"
  (
    echo "$crmagic_hex $version_hex $header_length $header_chunk_1" | xxd -r -p
    cat "$pub"
    echo "$header_chunk_2" | xxd -r -p
    cat "$sig"
    echo "$header_chunk_3" | xxd -r -p
    cat "$binary_crx_id" "$zip"
  ) > "$crx"
  echo "Wrote $crx"
}

function get_client() {
  local container=$(docker ps -a | grep "chrome-sync" | awk '{print $1}')
  docker cp "$container":/opt/chrome-sync-client/build .
}

function build(){
  local HOSTNAME="$1"
  [ -z "$HOSTNAME" ] && HOSTNAME="localhost"

  create_container "$HOSTNAME"
  get_client

  # TODO not needed if chrome won't allow anyway?
  #  generate_extentsion_keys
  #  package_client
}

function clean() {
  local container=$(docker ps -a | grep "chrome-sync" | awk '{print $1}')
  local image=$(docker image ls | grep "chrome-sync" | awk '{print $3}')
  [ -n "$container" ] && docker stop "$container" && docker rm "$container"
  [ -n "$image" ] && docker image rm "$image"
  rm -rf build
}

function main() {
  check_deps

  if [ "$#" -eq 0 ]; then
    build
  else
    while true; do
      case "$1" in
        --hostname   ) HOSTNAME=$2; build "$HOSTNAME"; exit ;;
        --get-client ) get_client ; exit ;;
        --clean      ) clean ; exit ;;
        --help       ) show_help ; exit ;;
        -- ) shift; break ;;
      * ) break ;;
      esac
    done
  fi
}
main "$@"