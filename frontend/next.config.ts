import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: '*.storage.googleapis.com',
      },
    ],
  },
  // Proxy API requests to backend during development
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';
    // Only proxy if using relative /api path
    if (apiUrl === '/api') {
      return [];
    }

    const backendUrl = apiUrl.replace('/api', '');

    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};

// Enable local IP optimization only in development
if (process.env.NODE_ENV !== 'production') {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not defined");
  }

  let hostname = 'localhost';
  let port = '8080';
  try {
    const url = new URL(apiUrl);
    hostname = url.hostname;
    port = url.port;
    console.log(`Hostname: ${hostname}`);
    console.log(`Port: ${port}`);

  } catch (error) {
    console.error("Invalid NEXT_PUBLIC_API_URL:", error);
  }

  nextConfig.images!.dangerouslyAllowLocalIP = true;
  nextConfig.images!.remotePatterns!.push({
    protocol: 'http',
    hostname: hostname,
    port: port,
    pathname: '/uploads/**',
  });
}

export default nextConfig;
