#!/bin/bash

###############################################################################
# Threads Auto-Post Installation Script for Windows (WSL2)
# 
# This script installs the application without Docker
# MongoDB and Redis are installed as local services
#
# Requirements:
# - Windows 10/11 with WSL2 enabled
# - Git Bash or WSL2 terminal
#
# Usage:
#   bash install.sh
#
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

###############################################################################
# Check system requirements
###############################################################################

check_requirements() {
    log_info "Checking system requirements..."

    # Check if running on WSL2
    if grep -i microsoft /proc/version > /dev/null 2>&1; then
        log_success "Running on WSL2"
    else
        log_warn "Not running on WSL2. This script is optimized for WSL2."
        log_info "Continue anyway? (y/n)"
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        log_info "Installing Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        NODE_VERSION=$(node -v)
        log_success "Node.js found: $NODE_VERSION"
    fi

    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    else
        NPM_VERSION=$(npm -v)
        log_success "npm found: $NPM_VERSION"
    fi

    # Check Git
    if ! command -v git &> /dev/null; then
        log_error "Git is not installed"
        log_info "Installing Git..."
        sudo apt-get install -y git
    else
        GIT_VERSION=$(git --version)
        log_success "$GIT_VERSION"
    fi
}

###############################################################################
# Install and configure MongoDB
###############################################################################

install_mongodb() {
    log_info "Setting up MongoDB..."

    # Check if MongoDB is already installed
    if command -v mongod &> /dev/null; then
        log_success "MongoDB is already installed"
        MONGO_VERSION=$(mongod --version | head -n 1)
        log_info "Version: $MONGO_VERSION"
        return
    fi

    log_info "Installing MongoDB..."
    
    # Import GPG key
    curl -fsSL https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

    # Add MongoDB repository
    echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | \
        sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

    # Update package list and install MongoDB
    sudo apt-get update
    sudo apt-get install -y mongodb-org

    log_success "MongoDB installed"

    # Create data directory
    sudo mkdir -p /data/db
    sudo chown -R $(id -u):$(id -g) /data/db
    log_success "MongoDB data directory created: /data/db"
}

###############################################################################
# Install and configure Redis
###############################################################################

install_redis() {
    log_info "Setting up Redis..."

    # Check if Redis is already installed
    if command -v redis-server &> /dev/null; then
        log_success "Redis is already installed"
        REDIS_VERSION=$(redis-server --version)
        log_info "Version: $REDIS_VERSION"
        return
    fi

    log_info "Installing Redis..."

    # Update package list
    sudo apt-get update

    # Install Redis
    sudo apt-get install -y redis-server

    log_success "Redis installed"

    # Create systemd service for Redis (optional)
    log_info "Configuring Redis as systemd service..."
    
    if [ ! -f /etc/systemd/system/redis.service ]; then
        cat << 'EOF' | sudo tee /etc/systemd/system/redis.service > /dev/null
[Unit]
Description=Redis In-Memory Data Store
After=network.target

[Service]
User=redis
ExecStart=/usr/bin/redis-server /etc/redis/redis.conf
ExecStop=/usr/bin/redis-cli shutdown
Restart=always

[Install]
WantedBy=multi-user.target
EOF
        
        sudo systemctl daemon-reload
        log_success "Redis systemd service created"
    fi
}

###############################################################################
# Clone repository (if needed)
###############################################################################

setup_repository() {
    log_info "Setting up repository..."

    # Check if we're already in the repo
    if [ -f "package.json" ]; then
        log_success "Already in project directory"
        return
    fi

    # Check if repo needs to be cloned
    log_info "Clone repository? (y/n)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        log_info "Enter repository URL:"
        read -r repo_url
        git clone "$repo_url" threads-auto-post
        cd threads-auto-post
        log_success "Repository cloned"
    fi
}

###############################################################################
# Install Node.js dependencies
###############################################################################

install_dependencies() {
    log_info "Installing Node.js dependencies..."

    # Install root dependencies
    npm install

    # Install backend dependencies
    cd apps/backend
    npm install
    cd ../..

    # Install frontend dependencies
    cd apps/frontend
    npm install
    cd ../..

    log_success "Dependencies installed"
}

###############################################################################
# Setup environment files
###############################################################################

setup_environment() {
    log_info "Setting up environment variables..."

    # Backend .env
    if [ ! -f "apps/backend/.env" ]; then
        log_info "Creating backend .env file..."
        cp apps/backend/.env.default apps/backend/.env
        
        log_info "Edit backend .env with your settings:"
        log_info "  THREADS_USER_ID"
        log_info "  THREADS_ACCESS_TOKEN"
        log_info "  THREADS_REFRESH_TOKEN"
        log_info "File: apps/backend/.env"
        
        log_warn "Please update apps/backend/.env with your Threads API credentials"
    else
        log_success "Backend .env already exists"
    fi

    # Frontend .env (if needed)
    if [ ! -f "apps/frontend/.env" ]; then
        log_info "Creating frontend .env file..."
        cat << 'EOF' > apps/frontend/.env
VITE_API_URL=http://localhost:3001
EOF
        log_success "Frontend .env created"
    fi
}

###############################################################################
# Create startup scripts
###############################################################################

create_startup_scripts() {
    log_info "Creating startup scripts..."

    # Start MongoDB script
    cat << 'EOF' > ./start-mongodb.sh
#!/bin/bash
echo "Starting MongoDB..."
mkdir -p /data/db
mongod --dbpath /data/db --logpath /data/db/mongod.log --fork
echo "MongoDB started on localhost:27017"
EOF
    chmod +x ./start-mongodb.sh
    log_success "Created: start-mongodb.sh"

    # Start Redis script
    cat << 'EOF' > ./start-redis.sh
#!/bin/bash
echo "Starting Redis..."
redis-server --daemonize yes
echo "Redis started on localhost:6379"
EOF
    chmod +x ./start-redis.sh
    log_success "Created: start-redis.sh"

    # Start development script
    cat << 'EOF' > ./start-dev.sh
#!/bin/bash
set -e

echo "🚀 Starting Threads Auto-Post Development Environment"
echo ""

# Check if services are running
echo "Checking services..."

# MongoDB
if ! pgrep mongod > /dev/null; then
    echo "📦 Starting MongoDB..."
    bash start-mongodb.sh
    sleep 2
else
    echo "✅ MongoDB is running"
fi

# Redis
if ! pgrep redis-server > /dev/null; then
    echo "📦 Starting Redis..."
    bash start-redis.sh
    sleep 2
else
    echo "✅ Redis is running"
fi

echo ""
echo "✅ All services ready!"
echo ""
echo "🔥 Starting application..."
echo ""
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start both frontend and backend
npm run dev
EOF
    chmod +x ./start-dev.sh
    log_success "Created: start-dev.sh"

    # Worker startup script
    cat << 'EOF' > ./start-worker.sh
#!/bin/bash
echo "🔧 Starting BullMQ Worker..."
echo ""
cd apps/backend
npm run worker
EOF
    chmod +x ./start-worker.sh
    log_success "Created: start-worker.sh"
}

###############################################################################
# Verify MongoDB
###############################################################################

verify_mongodb() {
    log_info "Verifying MongoDB installation..."

    if ! command -v mongosh &> /dev/null && ! command -v mongo &> /dev/null; then
        log_warn "MongoDB shell not found. Install with:"
        log_info "  sudo apt-get install -y mongodb-mongosh"
        return
    fi

    # Create test database
    if command -v mongosh &> /dev/null; then
        mongosh --eval "db.version()" > /dev/null 2>&1 && \
            log_success "MongoDB is working correctly"
    else
        mongo --eval "db.version()" > /dev/null 2>&1 && \
            log_success "MongoDB is working correctly"
    fi
}

###############################################################################
# Verify Redis
###############################################################################

verify_redis() {
    log_info "Verifying Redis installation..."

    if ! command -v redis-cli &> /dev/null; then
        log_error "redis-cli not found"
        return
    fi

    redis-cli ping > /dev/null 2>&1 && \
        log_success "Redis is working correctly" || \
        log_warn "Redis is not running. Start with: redis-server"
}

###############################################################################
# Print summary
###############################################################################

print_summary() {
    cat << 'EOF'

╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     ✅ Installation Complete!                             ║
║                                                            ║
║  Threads Auto-Post is ready to run on Windows (WSL2)      ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

📋 NEXT STEPS:

1. Configure your Threads API credentials:
   
   Edit: apps/backend/.env
   
   Add your credentials:
     THREADS_USER_ID=your-id
     THREADS_ACCESS_TOKEN=your-token
     THREADS_REFRESH_TOKEN=your-refresh-token

2. Start the development environment:
   
   bash start-dev.sh

3. In a separate terminal, start the worker:
   
   bash start-worker.sh

4. Open in browser:
   
   Frontend: http://localhost:5173
   API:      http://localhost:3001

📚 DOCUMENTATION:

  - Architecture:    cat ARCHITECTURE.md
  - Setup Guide:     cat SETUP.md
  - API Reference:   cat apps/backend/README.md

🛠️ USEFUL COMMANDS:

  Development:
    npm run dev              # Start frontend + backend
    npm run worker           # Start BullMQ worker
    npm run test:integration # Run integration tests

  MongoDB:
    bash start-mongodb.sh    # Start MongoDB
    mongosh                  # Connect to MongoDB shell

  Redis:
    bash start-redis.sh      # Start Redis
    redis-cli                # Connect to Redis shell

  Services:
    pgrep mongod             # Check if MongoDB is running
    pgrep redis-server       # Check if Redis is running
    ps aux | grep node       # Check if app is running

🐛 TROUBLESHOOTING:

  MongoDB won't start:
    sudo systemctl start mongodb

  Redis won't start:
    redis-server

  Port already in use:
    Check what's using ports 3001, 5173, 27017, 6379
    lsof -i :PORT_NUMBER

💡 TIPS:

  - Run start-dev.sh to start all services automatically
  - Run start-worker.sh in a separate terminal
  - Use redis-cli and mongosh for direct database access
  - Check logs in: apps/backend/logs/

╚════════════════════════════════════════════════════════════╝

EOF
}

###############################################################################
# Main execution
###############################################################################

main() {
    clear
    
    cat << 'EOF'
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║          Threads Auto-Post Installation Script            ║
║                    Windows (WSL2) Edition                 ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

EOF

    log_info "Starting installation process..."
    echo ""

    # Run installation steps
    check_requirements
    echo ""
    
    install_mongodb
    echo ""
    
    install_redis
    echo ""
    
    setup_repository
    echo ""
    
    install_dependencies
    echo ""
    
    setup_environment
    echo ""
    
    create_startup_scripts
    echo ""
    
    verify_mongodb
    verify_redis
    echo ""
    
    print_summary
}

# Run main function
main "$@"
