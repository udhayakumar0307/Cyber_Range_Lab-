#!/bin/bash
# Generate a complete docker-compose.yml with 60 student services (ports 2220-2279)

OUTPUT_FILE="docker-compose.yml"
BASE_PORT=2220
NUM_STUDENTS=60

cat > "$OUTPUT_FILE" << 'EOF'
version: '3.8'

services:
EOF

# Generate service definitions for each student
for i in $(seq 0 $((NUM_STUDENTS - 1))); do
    PORT=$((BASE_PORT + i))
    
    cat >> "$OUTPUT_FILE" << SERVICEDEF
  student${i}:
    image: techcorp-sysadmin-labs:latest
    container_name: student${i}
    hostname: techcorp-server
    ports:
      - "${PORT}:2222"
    volumes:
      - student${i}_home:/home
      - student${i}_opt:/opt
      - student${i}_var:/var
    environment:
      - STUDENT_ID=${i}
    networks:
      - techcorp-labs
    restart: unless-stopped

SERVICEDEF
done

# Add volumes section
cat >> "$OUTPUT_FILE" << 'EOF'
volumes:
EOF

for i in $(seq 0 $((NUM_STUDENTS - 1))); do
    cat >> "$OUTPUT_FILE" << VOLDEF
  student${i}_home:
  student${i}_opt:
  student${i}_var:
VOLDEF
done

# Add networks section
cat >> "$OUTPUT_FILE" << 'EOF'

networks:
  techcorp-labs:
    driver: bridge
EOF

echo "Generated $OUTPUT_FILE with $NUM_STUDENTS services (ports ${BASE_PORT}-$((BASE_PORT + NUM_STUDENTS - 1)))"
