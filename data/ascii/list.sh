#!/bin/bash

for file in *; do
    # Check if the item is a regular file
    if [[ -f "$file" ]]; then
        echo "--- File: $file ---"
        cat "$file"
        echo "" # Add an extra newline for separation between files
    fi
done

