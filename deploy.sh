#!/bin/bash
# Deploy Kabi Receipts to Google Cloud Run
# Usage: ./deploy.sh [PROJECT_ID] [REGION] [--backend] [--frontend]
# Options:
#   --backend, -b   Deploy only the backend API
#   --frontend, -f  Deploy only the frontend web app
#   (default: deploy both if no options specified)

set -e

# Parse arguments
DEPLOY_BACKEND=false
DEPLOY_FRONTEND=false
POSITIONAL_ARGS=()

while [[ $# -gt 0 ]]; do
    case $1 in
        --backend|-b)
            DEPLOY_BACKEND=true
            shift
            ;;
        --frontend|-f)
            DEPLOY_FRONTEND=true
            shift
            ;;
        *)
            POSITIONAL_ARGS+=("$1")
            shift
            ;;
    esac
done

# If no specific service was requested, deploy both
if [ "$DEPLOY_BACKEND" = false ] && [ "$DEPLOY_FRONTEND" = false ]; then
    DEPLOY_BACKEND=true
    DEPLOY_FRONTEND=true
fi

# Restore positional arguments
set -- "${POSITIONAL_ARGS[@]}"

# Configuration
PROJECT_ID="${1:-$(gcloud config get-value project)}"
REGION="${2:-us-west1}"
BACKEND_SERVICE="kabi-receipts-api"
FRONTEND_SERVICE="kabi-receipts-web"
BUCKET_NAME="${PROJECT_ID}-original-receipt-images"

# Get project number for the Default Compute Service Account (Standard for Cloud Run)
echo "� Fetching project number..."
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')

if [ -z "$PROJECT_NUMBER" ]; then
    echo "❌ Error: Could not determine PROJECT_NUMBER for project ${PROJECT_ID}. Access to Secret Manager requires a project number."
    exit 1
fi

echo "�🚀 Deploying Kabi Receipts to Cloud Run"
echo "   Project: ${PROJECT_ID} (${PROJECT_NUMBER})"
echo "   Region: ${REGION}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed"
    echo "   Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Set project
echo "📋 Setting project..."
gcloud config set project ${PROJECT_ID}

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    firestore.googleapis.com \
    storage.googleapis.com \
    secretmanager.googleapis.com

# Create Cloud Storage bucket if it doesn't exist
echo "🪣 Checking Cloud Storage bucket..."
if ! gsutil ls gs://${BUCKET_NAME} &> /dev/null; then
    echo "   Creating bucket: ${BUCKET_NAME}"
    gsutil mb -l ${REGION} gs://${BUCKET_NAME}
else
    echo "   Bucket already exists: ${BUCKET_NAME}"
fi

# Set bucket CORS for web uploads
echo "📝 Configuring bucket CORS..."
cat > /tmp/cors.json << EOF
[
  {
    "origin": ["*"],
    "method": ["GET", "PUT", "POST", "DELETE"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
EOF
gsutil cors set /tmp/cors.json gs://${BUCKET_NAME}

# Check if Firestore is set up
echo "🔥 Checking Firestore..."
if ! gcloud firestore databases describe --project=${PROJECT_ID} &> /dev/null; then
    echo "   Creating Firestore database in Native mode..."
    gcloud firestore databases create --location=${REGION}
fi

# --- Secret Management Helper ---
# Helper to ensure a secret exists and has a value, and that service accounts have access
ensure_secret() {
    local SECRET_NAME=$1
    local PROMPT_MSG=$2
    local DEFAULT_VAL=$3

    if ! gcloud secrets describe ${SECRET_NAME} &> /dev/null; then
        echo "🔐 Creating secret: ${SECRET_NAME}"
        
        local VALUE=${DEFAULT_VAL}
        if [ -z "${VALUE}" ]; then
            echo "⚠️  ${PROMPT_MSG}"
            read -p "> " VALUE
        fi

        echo -n "${VALUE}" | gcloud secrets create ${SECRET_NAME} --data-file=- --replication-policy="automatic"
    else
        echo "✅ Secret exists: ${SECRET_NAME}"
    fi

    # Always ensure service account has access (in case the secret was created manually)
    echo "   Ensuring Cloud Run service account access..."
    
    # Use the Default Compute Service Account (Standard for Cloud Run)
    gcloud secrets add-iam-policy-binding ${SECRET_NAME} \
        --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
        --role="roles/secretmanager.secretAccessor" --quiet || true
}

# --- Environment Variable & Secret Setup ---

echo "🔑 Checking required secrets..."

# 1. Gemini API Key (Existing)
ensure_secret "gemini-api-key" "Enter your Google Gemini API Key"

# 2. Google OAuth Client Secret (New - Sensitive)
ensure_secret "google-client-secret" "Enter your Google OAuth Client Secret"

# 3. NextAuth Secret (New - Sensitive)
RANDOM_SECRET=$(openssl rand -base64 32)
ensure_secret "nextauth-secret" "Enter NextAuth Secret (or leave blank to generate)" "${RANDOM_SECRET}"

# --- Regular Environment Variables (Non-sensitive) ---

if [ -z "$GOOGLE_CLIENT_ID" ]; then
    echo "ℹ️  GOOGLE_CLIENT_ID not found in shell environment."
    read -p "Enter Google OAuth Client ID: " GOOGLE_CLIENT_ID
fi

if [ -z "$ALLOWED_USERS" ]; then
    echo "ℹ️  ALLOWED_USERS not found in shell environment."
    read -p "Enter allowed emails (comma separated, or leave blank): " ALLOWED_USERS
fi


# Deploy Backend API
if [ "$DEPLOY_BACKEND" = true ]; then
    echo ""
    echo "🏗️ Deploying Backend API..."
    # Initial deployment with dummy CORS, will update after frontend is deployed
    gcloud run deploy ${BACKEND_SERVICE} \
        --source . \
        --region ${REGION} \
        --platform managed \
        --allow-unauthenticated \
        --memory 512Mi \
        --cpu 1 \
        --min-instances 0 \
        --max-instances 2 \
        --set-env-vars "^|^GCP_PROJECT_ID=${PROJECT_ID}|GCS_BUCKET_NAME=${BUCKET_NAME}|STORAGE_MODE=gcs|GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}|ALLOWED_USERS=${ALLOWED_USERS}|ALLOWED_ORIGINS=http://localhost:3000" \
        --set-secrets "GOOGLE_API_KEY=gemini-api-key:latest"
fi

# Get backend URL (even if not deploying, we might need it for frontend)
BACKEND_URL=$(gcloud run services describe ${BACKEND_SERVICE} --region ${REGION} --format='value(status.url)' 2>/dev/null || echo "")
if [ -n "$BACKEND_URL" ]; then
    echo "   Backend URL: ${BACKEND_URL}"
else
    echo "   ⚠️  Backend service not found or not yet deployed."
fi

# Deploy Frontend
if [ "$DEPLOY_FRONTEND" = true ]; then
    if [ -z "$BACKEND_URL" ]; then
        echo "❌ Error: Cannot deploy frontend without backend URL. Please deploy backend first."
        exit 1
    fi

    echo ""
    echo "🎨 Deploying Frontend..."
    cd frontend

    gcloud builds submit --config cloudbuild.yaml \
        --substitutions="_FRONTEND_SERVICE=${FRONTEND_SERVICE},_NEXT_PUBLIC_API_URL=${BACKEND_URL}/api" .

    gcloud run deploy ${FRONTEND_SERVICE} \
        --image gcr.io/${PROJECT_ID}/${FRONTEND_SERVICE} \
        --region ${REGION} \
        --platform managed \
        --allow-unauthenticated \
        --memory 256Mi \
        --cpu 1 \
        --min-instances 0 \
        --max-instances 2 \
        --set-env-vars "^|^NEXT_PUBLIC_API_URL=${BACKEND_URL}/api|GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}" \
        --set-secrets "GOOGLE_CLIENT_SECRET=google-client-secret:latest,NEXTAUTH_SECRET=nextauth-secret:latest" \
        --set-build-env-vars "NEXT_PUBLIC_API_URL=${BACKEND_URL}/api"
    cd ..
fi

# Get frontend URL
FRONTEND_URL=$(gcloud run services describe ${FRONTEND_SERVICE} --region ${REGION} --format='value(status.url)' 2>/dev/null || echo "")

if [ -n "$FRONTEND_URL" ] && [ -n "$BACKEND_URL" ]; then
    echo ""
    echo "🔄 Updating Backend with correct CORS origin..."
    gcloud run services update ${BACKEND_SERVICE} \
        --region ${REGION} \
        --update-env-vars "ALLOWED_ORIGINS=${FRONTEND_URL}"

    echo "🔄 Updating Frontend with correctly configured NEXTAUTH_URL..."
    gcloud run services update ${FRONTEND_SERVICE} \
        --region ${REGION} \
        --update-env-vars "NEXTAUTH_URL=${FRONTEND_URL}"
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Your application is live:"
echo "   Frontend: ${FRONTEND_URL}"
echo "   Backend API: ${BACKEND_URL}"
echo ""
echo "📝 Note:"
echo "   Your secrets are now stored in Google Cloud Secret Manager."
echo "   You can manage them at: https://console.cloud.google.com/security/secret-manager?project=${PROJECT_ID}"
echo ""
