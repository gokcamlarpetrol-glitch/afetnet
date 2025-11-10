#!/bin/bash

# Database Setup Script for AfetNet IAP Server
# This script sets up PostgreSQL database and runs migrations

set -e

echo "🚀 Setting up AfetNet IAP Database..."

# Database configuration
DB_NAME=${DB_NAME:-afetnet_iap}
DB_USER=${DB_USER:-postgres}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

echo "📊 Database Configuration:"
echo "   Host: $DB_HOST:$DB_PORT"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"

# Check if PostgreSQL is running
if ! pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER; then
    echo "❌ PostgreSQL is not running or not accessible"
    echo "   Please start PostgreSQL and ensure it's accessible"
    exit 1
fi

echo "✅ PostgreSQL is running"

# Create database if it doesn't exist
echo "🔍 Checking if database exists..."
if ! psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo "📝 Creating database: $DB_NAME"
    createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME
    echo "✅ Database created successfully"
else
    echo "✅ Database already exists"
fi

# Run migrations
echo "🔄 Running database migrations..."
if [ -f "migrations/001_create_iap_tables.sql" ]; then
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f migrations/001_create_iap_tables.sql
    echo "✅ Migration completed successfully"
else
    echo "❌ Migration file not found: migrations/001_create_iap_tables.sql"
    exit 1
fi

# Test database connection
echo "🧪 Testing database connection..."
if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT NOW();" > /dev/null 2>&1; then
    echo "✅ Database connection test successful"
else
    echo "❌ Database connection test failed"
    exit 1
fi

# Show database tables
echo "📋 Database tables created:"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "\dt"

echo ""
echo "🎉 Database setup completed successfully!"
echo ""
echo "📝 Next steps:"
echo "   1. Set environment variables:"
echo "      export DB_HOST=$DB_HOST"
echo "      export DB_PORT=$DB_PORT"
echo "      export DB_NAME=$DB_NAME"
echo "      export DB_USER=$DB_USER"
echo "      export DB_PASSWORD=your_password"
echo "      export APPLE_SHARED_SECRET=your_apple_shared_secret"
echo ""
echo "   2. Start the server:"
echo "      npm run dev"
echo ""
echo "   3. Test the endpoints:"
echo "      curl http://localhost:3001/health"
echo "      curl http://localhost:3001/api/iap/products"
