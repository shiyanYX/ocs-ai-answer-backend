#!/bin/bash
cd "$(dirname "$0")"
PORT=3000 HOST=0.0.0.0 node src/index.js
