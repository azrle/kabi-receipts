#!/bin/bash
# Deploy Kabi Receipts to Google Cloud Run
# Usage: ./deploy.sh [PROJECT_ID] [REGION]

set -e

# Configuration
PROJECT_ID="${1:-$(gcloud config get-value project)}"
REGION="${2:-us-central1}"
BACKEND_SERVICE="kabi-receipts-api"
FRONTEND_SERVICE="kabi-receipts-web"
BUCKET_NAME="${PROJECT_ID}-receipts"

echo "🚀 Deploying Kabi Receipts to Cloud Run"
echo "   Project: ${PROJECT_ID}"
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
# Note: vision.googleapis.com is no longer needed

# Create Cloud Storage bucket if it doesn't exist
echo "🪣 Creating Cloud Storage bucket..."
if ! gsutil ls gs://${BUCKET_NAME} &> /dev/null; then
    gsutil mb -l ${REGION} gs://${BUCKET_NAME}
    echo "   Created bucket: ${BUCKET_NAME}"
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

# Deploy Backend API
echo ""
echo "🏗️ Deploying Backend API..."
gcloud run deploy ${BACKEND_SERVICE} \
    --source . \
    --region ${REGION} \
    --platform managed \
    --allow-unauthenticated \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 2 \
    --set-env-vars "GCP_PROJECT_ID=${PROJECT_ID},GCS_BUCKET_NAME=${BUCKET_NAME}" \
    --set-secrets "GOOGLE_API_KEY=gemini-api-key:latest"

# Get backend URL
BACKEND_URL=$(gcloud run services describe ${BACKEND_SERVICE} --region ${REGION} --format='value(status.url)')
echo "   Backend deployed: ${BACKEND_URL}"

# Deploy Frontend
echo ""
echo "🎨 Deploying Frontend..."
cd frontend
gcloud run deploy ${FRONTEND_SERVICE} \
    --source . \
    --region ${REGION} \
    --platform managed \
    --allow-unauthenticated \
    --memory 256Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 2 \
    --set-env-vars "NEXT_PUBLIC_API_URL=${BACKEND_URL}/api" \
    --build-env-vars "NEXT_PUBLIC_API_URL=${BACKEND_URL}/api"
cd ..

# Get frontend URL
FRONTEND_URL=$(gcloud run services describe ${FRONTEND_SERVICE} --region ${REGION} --format='value(status.url)')

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Your application is live:"
echo "   Frontend: ${FRONTEND_URL}"
echo "   Backend API: ${BACKEND_URL}"
echo ""
echo "📝 Next steps (if not already done):"
echo "   1. Create a secret for Gemini API key:"
echo "      echo -n 'YOUR_API_KEY' | gcloud secrets create gemini-api-key --data-file=-"
echo ""
echo "   2. Grant Cloud Run access to the secret:"
echo "      gcloud secrets add-iam-policy-binding gemini-api-key \\"
echo "        --member=serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com \\"
echo "        --role=roles/secretmanager.secretAccessor"
echo ""
