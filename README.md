# Abstract Altitudes

Capturing breathtaking aerial imagery and video through drone flights, showcasing stunning landscapes, vibrant cityscapes, and unique perspectives from above.

## Table of Contents

- [Features](#features)
- [Technologies Used](#technologies-used)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Installation](#installation)
- [Usage / Scripts](#usage--scripts)
- [Media Upload Folder Layout](#media-upload-folder-layout)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)
- [Acknowledgments](#acknowledgments)

## Features

- **Image Gallery** – high-resolution stills
- **Interactive Map** – every shot geotagged
- **Pano Viewer** – 360° spherical images via Marzipano
- **Responsive Design** – desktop, tablet & mobile
- **PWA ready** – installable offline app

## Technologies Used

- **Frontend**: React 18 + Vite
- **Backend**: Node.js 20 + Express
- **DB**: MongoDB Atlas (collection `abstractaltitudes`)
- **Object Storage**: AWS S3 bucket
- **Image Processing**: Sharp
- **Reverse Geocoding**: Mapbox
- **Containerisation**: Docker / Docker Compose

## Prerequisites

1. MongoDB Atlas cluster + database with a collection named `abstractaltitudes`
2. AWS S3 bucket (and IAM keys with `PutObject`, `DeleteObject`, `ListBucket`)
3. Mapbox account (https://mapbox.com) – enable **Geocoding API**
4. Google Cloud account – enable **Maps JavaScript API** (key reserved for future use)
5. Node ≥ 20 & pnpm ≥ 8
6. Docker Desktop (only if you run the containerised version)

## Environment Variables

The table below shows every key you must supply.  
Put them in `.env` (local dev) **and** `env.production` (build time) unless the **Scope** column says otherwise.

| Variable                   | Example / Hint                    | Scope         | Purpose                                                |
| -------------------------- | --------------------------------- | ------------- | ------------------------------------------------------ |
| `MONGODB_SERVER`           | `cluster0.xxxxx.mongodb.net`      | both          | MongoDB Atlas host                                     |
| `MONGODB_DB`               | `abstractaltitudes`               | both          | database name                                          |
| `MONGODB_DB_USER`          | `dbUser`                          | both          | Atlas DB user                                          |
| `MONGODB_DB_PASSWORD`      | `superSecretPw`                   | both          | Atlas DB password                                      |
| `AWS_BUCKET`               | `my-drone-assets`                 | both          | S3 bucket for originals & derivatives                  |
| `AWS_ACCESS_KEY_ID`        | `AKIA…`                           | both          | IAM key with `PutObject`, `DeleteObject`, `ListBucket` |
| `AWS_SECRET_ACCESS_KEY`    | `wJalrXUtnFEMI/K7MDENG/bPxRfiCY…` | both          | IAM secret                                             |
| `AWS_DEFAULT_REGION`       | `eu-central-1`                    | both          | bucket region                                          |
| `MAPBOX_SECRET_TOKEN`      | `sk.eyJ1Ijoi……`                   | **prod only** | server-side reverse-geocoding                          |
| `VITE_MAPBOX_PUBLIC_TOKEN` | `pk.eyJ1Ijoi……`                   | both          | browser-side tiles & fonts                             |
| `VITE_GOOGLE_MAPS_API_KEY` | `AIzaSyA……`                       | both          | Google services (reserved)                             |
| `VITE_API_URL`             | `http://localhost:8081/api`       | **dev only**  | front-end → back-end route                             |
| `VITE_API_URL`             | `/api`                            | **prod only** | same route, root-relative                              |

---

The table below shows every key you must supply.  
Put them in `.env` (local dev) **only** for the following new folder paths used in media management and archiving:

| Variable            | Example / Hint           | Scope        | Purpose                                                      |
| ------------------- | ------------------------ | ------------ | ------------------------------------------------------------ |
| `INPUT_DIRECTORY`   | `/Users/me/DroneUploads` | **dev only** | Base folder containing media folders to ingest and process.  |
| `OUTPUT_DIRECTORY`  | `/Users/me/DroneJPGs`    | **dev only** | Destination folder for converted high-res JPEG images.       |
| `ARCHIVE_DIRECTORY` | `/Users/me/DroneArchive` | **dev only** | Folder where processed media folders are moved after upload. |

> **Note:** These directories are used by the backend management scripts for organizing, converting, archiving, and uploading drone media content locally during ingestion before cloud upload. They must be properly configured on your local system but should _not_ be defined in production environment files or build-time configs.

---

### Why these variables matter

- **`INPUT_DIRECTORY`** is where the uploader scans for new drone media uploads (original RAW, TIFF, panoramas, etc).
- **`OUTPUT_DIRECTORY`** is where your conversion script exports high-quality JPEGs from TIFF or panorama sources for downstream use.
- **`ARCHIVE_DIRECTORY`** is where processed media folders are moved after successful upload and conversion, preventing duplicate processing.

---

Add these entries with appropriate absolute paths to your `.env` file only, as they represent local file system paths used during development and batch ingestion.

&gt; [!IMPORTANT]  
&gt; Never commit `.env` or `env.production`; they are already listed in `.gitignore`.

## Installation

```bash
git clone https://github.com/wrangel/abstractaltitudes.git
cd abstractaltitudes
pnpm install
```

Create the two env-files in the root (see table above) and fill in the values.

## Usage / Scripts

| Command       | Purpose                                                                                |
| ------------- | -------------------------------------------------------------------------------------- |
| `pnpm dev`    | Start backend + Vite frontend locally (no Docker)                                      |
| `pnpm dev -u` | Same as above, but updates & audits deps first                                         |
| `pnpm test`   | Build & run the full stack locally in Docker                                           |
| `pnpm prod`   | Build images and push `wrangel/abstractaltitudes-{frontend,backend}:2.1` to Docker Hub |

Management helpers:

```bash
pnpm manage keep-books   # sync DB ↔ S3 metadata
pnpm manage upload-media # ingest new imagery
pnpm manage upload-media -n # ingest new imagery, but do not upload it neither to AWS nor Mongo db
```

## Media Upload Folder Layout

Place everything inside the folder you point the uploader to:

```bash
your-ingest-folder/
├── nonpano/
│ └── any-name/
│ ├── IMG_1234.JPG # original drone still
│ ├── IMG_1234.tif # 16-bit TIFF derived from RAW (optional)
│ └── …
└── pano/
└── any-name/
├── DJI_0001.JPG # individual aerial shots
├── DJI_0002.JPG
├── pano-equirect.jpg # stitched 360° equirectangular (e.g. from PTGui Pro)
├── pano-equirect.pts # stitched 360° equirectangular project file (e.g. from PTGui Pro)
└── project-title.zip # Marzipano project exported from https://www.marzipano.net/tool/
```

The uploader walks these folders, uploads originals to S3, writes metadata to MongoDB and generates the multiple sizes required by the gallery.

## Contributing

1. Fork the repo
2. `git checkout -b feature/YourFeature`
3. Commit & push
4. Open a pull request

## License

MIT – see [LICENSE](LICENSE)

## Contact

GitHub: [@wrangel](https://github.com/wrangel)

## Acknowledgments

Thanks to [Perplexity.ai](https://www.perplexity.ai/), [kimi.com](https://kimi.com), [Microsoft Copilot](https://copilot.microsoft.com/), and [Marius Hosting](https://mariushosting.com/) for making this possible.
