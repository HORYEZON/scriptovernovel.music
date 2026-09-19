-- CreateEnum
CREATE TYPE "MuseumRoomType" AS ENUM ('MAIN_HALL', 'GALLERY', 'SPECIAL_EXHIBITION', 'ABOUT', 'FREEDOM_WALL', 'STAIRS', 'SERVICES', 'STORIES', 'ARCADE', 'COSPLAY');

-- CreateEnum
CREATE TYPE "EventMediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "ActivityCategory" AS ENUM ('CONTENT', 'AUTH', 'COMMERCE', 'VISITOR', 'SYSTEM');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'SHIPPED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "ArtworkStatus" AS ENUM ('AVAILABLE', 'SOLD');

-- CreateEnum
CREATE TYPE "StoryType" AS ENUM ('BOOK', 'NOVEL', 'COMIC', 'MANGA', 'ANTHOLOGY', 'ARTBOOK', 'ZINE', 'WEBTOON');

-- CreateEnum
CREATE TYPE "MiniGameType" AS ENUM ('ART_PUZZLE', 'ROTATE_SOLVE', 'SLIDING_PUZZLE', 'MEMORY_CARDS', 'FIND_DIFFERENCE');

-- CreateEnum
CREATE TYPE "MiniGameDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "MiniGameSessionStatus" AS ENUM ('CREATED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RewardClaimStatus" AS ENUM ('PENDING', 'FULFILLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ORDER', 'HIGHSCORE', 'CONTACT', 'MUSEUM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "lastLoginUserAgent" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "totpRecoveryCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "totpSecret" TEXT,
    "inactivityLogoutEnabled" BOOLEAN NOT NULL DEFAULT false,
    "inactivityLogoutMinutes" INTEGER NOT NULL DEFAULT 30,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "profileImage" TEXT,
    "headline" TEXT,
    "instagram" TEXT,
    "facebook" TEXT,
    "twitter" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "backgroundImage" TEXT,
    "profileImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "logoImage" TEXT,
    "basedIn" TEXT,
    "displayName" TEXT,
    "experience" TEXT,
    "languages" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "commissionHeading" TEXT,
    "commissionIntro" TEXT,
    "contactHeading" TEXT,
    "contactIntro" TEXT,
    "iconImage" TEXT,
    "chatIcon" TEXT,
    "sidebarIcon" TEXT,
    "sidebarIconColors" TEXT[] DEFAULT ARRAY['#FFE135', '#44D700', '#FF6B9D', '#5BC8F5']::TEXT[],
    "carouselMode" TEXT NOT NULL DEFAULT 'auto',
    "carouselSpeed" INTEGER NOT NULL DEFAULT 5,
    "storiesCarouselMode" TEXT NOT NULL DEFAULT 'auto',
    "storiesCarouselSpeed" INTEGER NOT NULL DEFAULT 5,
    "hoverShimmer" JSONB,
    "maintenanceMessage" TEXT,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "musicEnabled" BOOLEAN NOT NULL DEFAULT false,
    "musicUrl" TEXT,
    "musicVolume" INTEGER NOT NULL DEFAULT 50,
    "introEffect" TEXT NOT NULL DEFAULT 'fade',
    "introEnabled" BOOLEAN NOT NULL DEFAULT true,
    "introSpeedMs" INTEGER NOT NULL DEFAULT 1400,
    "introText" TEXT NOT NULL DEFAULT 'Contemporary Filipino Art',
    "introTextAbove" TEXT NOT NULL DEFAULT '',
    "introBgColor" TEXT NOT NULL DEFAULT '#0D0D0D',
    "introTaglineFontSize" TEXT NOT NULL DEFAULT '0.75rem',
    "introTaglineColor" TEXT NOT NULL DEFAULT '#E8D5A8',
    "introTaglineAboveFontSize" TEXT NOT NULL DEFAULT '0.75rem',
    "introTaglineAboveColor" TEXT NOT NULL DEFAULT '#E8D5A8',
    "introTaglineFontFamily" TEXT NOT NULL DEFAULT 'var(--font-dm-sans), system-ui, sans-serif',
    "introTaglineAboveFontFamily" TEXT NOT NULL DEFAULT 'var(--font-dm-sans), system-ui, sans-serif',
    "introTaglineFontSizeMobile" TEXT,
    "introTaglineAboveFontSizeMobile" TEXT,
    "introGlowIntensity" INTEGER NOT NULL DEFAULT 0,
    "introGlowColor" TEXT NOT NULL DEFAULT '#E8D5A8',
    "introGlowShimmer" BOOLEAN NOT NULL DEFAULT true,
    "introGlowOffsetX" INTEGER NOT NULL DEFAULT 0,
    "introGlowOffsetY" INTEGER NOT NULL DEFAULT 0,
    "introSquidColor" TEXT NOT NULL DEFAULT '#F5F1E8',
    "introLetterColors" TEXT NOT NULL DEFAULT 'hover',
    "errorIcon" TEXT,
    "faviconIcon" TEXT,
    "footerIcon" TEXT,
    "maintenanceIcon" TEXT,
    "sidebarMobileIcon" TEXT,
    "splashIcon" TEXT,
    "faviconIconColors" TEXT[] DEFAULT ARRAY['#FFE135', '#44D700', '#FF6B9D', '#5BC8F5']::TEXT[],
    "footerIconColors" TEXT[] DEFAULT ARRAY['#FFE135', '#44D700', '#FF6B9D', '#5BC8F5']::TEXT[],
    "maintenanceIconColors" TEXT[] DEFAULT ARRAY['#FFE135', '#44D700', '#FF6B9D', '#5BC8F5']::TEXT[],
    "sidebarMobileIconColors" TEXT[] DEFAULT ARRAY['#FFE135', '#44D700', '#FF6B9D', '#5BC8F5']::TEXT[],
    "splashIconColors" TEXT[] DEFAULT ARRAY['#FFE135', '#44D700', '#FF6B9D', '#5BC8F5']::TEXT[],
    "callingCardFront" TEXT,
    "callingCardBack" TEXT,
    "releaseNotesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "releaseNotesLimit" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseNote" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "version" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ReleaseNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoundEffect" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'prebuilt',
    "preset" TEXT NOT NULL DEFAULT 'click',
    "url" TEXT,
    "volume" INTEGER NOT NULL DEFAULT 70,
    "waveform" TEXT NOT NULL DEFAULT 'triangle',
    "frequency" INTEGER NOT NULL DEFAULT 420,
    "durationMs" INTEGER NOT NULL DEFAULT 70,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoundEffect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteTheme" (
    "id" TEXT NOT NULL,
    "btnPrimaryColor" TEXT NOT NULL DEFAULT '#E8D5A8',
    "btnSecondaryColor" TEXT NOT NULL DEFAULT '#E8D5A8',
    "btnHoverColor" TEXT NOT NULL DEFAULT '#C8A96E',
    "scrollbarTrackColor" TEXT NOT NULL DEFAULT 'transparent',
    "scrollbarThumbColor" TEXT NOT NULL DEFAULT '#C8A96E',
    "fontFamily" TEXT NOT NULL DEFAULT 'var(--font-dm-sans), system-ui, sans-serif',
    "fontSizeBase" TEXT NOT NULL DEFAULT '16px',
    "fontSizeHeading" TEXT NOT NULL DEFAULT '2rem',
    "fontSizeBody" TEXT NOT NULL DEFAULT '1rem',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cursorGlowColors" TEXT[] DEFAULT ARRAY['#FFE135', '#44D700', '#5BC8F5', '#FF6B9D']::TEXT[],
    "cursorGlowEnabled" BOOLEAN NOT NULL DEFAULT true,
    "darkBrightness" INTEGER NOT NULL DEFAULT 90,
    "darkWashColor" TEXT NOT NULL DEFAULT 'rgba(6, 6, 10, 0.72)',
    "lightBrightness" INTEGER NOT NULL DEFAULT 90,
    "lightWashColor" TEXT NOT NULL DEFAULT 'rgba(151, 150, 150, 0.54)',
    "darkWashScope" TEXT NOT NULL DEFAULT 'public',
    "lightWashScope" TEXT NOT NULL DEFAULT 'public',
    "bgBlur" TEXT NOT NULL DEFAULT '10px',
    "adminBackgroundImage" TEXT,
    "adminBgBlur" TEXT NOT NULL DEFAULT '0px',
    "adminCardBgDark" TEXT NOT NULL DEFAULT 'rgba(0, 0, 0, 0.4)',
    "adminCardBgLight" TEXT NOT NULL DEFAULT '#FFFFFF',
    "adminInputBgDark" TEXT NOT NULL DEFAULT 'rgba(255, 255, 255, 0.05)',
    "adminInputBgLight" TEXT NOT NULL DEFAULT 'rgba(0, 0, 0, 0.05)',
    "adminModalBgDark" TEXT NOT NULL DEFAULT '#0D0D0D',
    "adminModalBgLight" TEXT NOT NULL DEFAULT '#FFFFFF',

    CONSTRAINT "SiteTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialLink" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "iconKey" TEXT NOT NULL,
    "hoverColor" TEXT NOT NULL DEFAULT '#FFE135',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtistSkill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hoverColor" TEXT NOT NULL DEFAULT '#FFE135',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtistSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "coverImageUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificateAward" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "issuer" TEXT,
    "dateAwarded" TIMESTAMP(3),
    "description" TEXT,
    "imageUrl" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artwork" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "tags" TEXT[],
    "medium" TEXT,
    "dimensions" TEXT,
    "year" INTEGER,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "ArtworkStatus" NOT NULL DEFAULT 'AVAILABLE',
    "sectionId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "isNewRelease" BOOLEAN NOT NULL DEFAULT false,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "slug" TEXT,
    "videoUrl" TEXT,
    "videoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Artwork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "StoryType" NOT NULL DEFAULT 'BOOK',
    "coverImageUrl" TEXT NOT NULL,
    "author" TEXT,
    "genre" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "year" INTEGER,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "slug" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "continueEnabled" BOOLEAN NOT NULL DEFAULT false,
    "continueUrl" TEXT,
    "continueLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cosplay" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "character" TEXT,
    "series" TEXT,
    "standeeImageUrl" TEXT NOT NULL,
    "backdropImageUrl" TEXT,
    "cosplayer" TEXT,
    "photographer" TEXT,
    "year" INTEGER,
    "event" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "slug" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Cosplay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryPage" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalMuseum" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "description" TEXT,
    "splashEnabled" BOOLEAN NOT NULL DEFAULT true,
    "splashEffect" TEXT NOT NULL DEFAULT 'fade',
    "splashSpeedMs" INTEGER NOT NULL DEFAULT 1400,
    "splashBgColor" TEXT NOT NULL DEFAULT '#0D0D0D',
    "splashTaglineFontSize" TEXT NOT NULL DEFAULT '0.75rem',
    "splashTaglineFontFamily" TEXT NOT NULL DEFAULT 'var(--font-dm-sans), system-ui, sans-serif',
    "splashStyle" TEXT NOT NULL DEFAULT 'full-page',
    "splashStyleMobile" TEXT NOT NULL DEFAULT 'full-page',
    "aboutSplashEnabled" BOOLEAN NOT NULL DEFAULT true,
    "aboutWallColor" TEXT NOT NULL DEFAULT '#ece7db',
    "aboutFloorColor" TEXT NOT NULL DEFAULT '#c9c0ad',
    "aboutCeilingColor" TEXT NOT NULL DEFAULT '#f4f2ec',
    "aboutWallTexture" TEXT,
    "aboutFloorTexture" TEXT,
    "aboutCeilingTexture" TEXT,
    "aboutSplashIcon" TEXT,
    "aboutSplashTitle" TEXT,
    "aboutEnabled" BOOLEAN NOT NULL DEFAULT true,
    "chaseCompanionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "chaseCompanionAssetType" TEXT,
    "chaseCompanionAssetUrl" TEXT,
    "achievementsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "achievementsHudEnabled" BOOLEAN NOT NULL DEFAULT true,
    "minimapConfig" TEXT,
    "museumMusicUrl" TEXT,
    "museumMusicEnabled" BOOLEAN NOT NULL DEFAULT false,
    "museumMusicVolume" INTEGER NOT NULL DEFAULT 50,
    "museumBrightnessLight" INTEGER NOT NULL DEFAULT 50,
    "museumBrightnessDark" INTEGER NOT NULL DEFAULT 50,
    "visionFiltersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "visionFilterConfig" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigitalMuseum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChaseCompanion" (
    "id" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "assetUrl" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChaseCompanion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuseumRoom" (
    "id" TEXT NOT NULL,
    "museumId" TEXT NOT NULL DEFAULT 'singleton',
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "roomType" "MuseumRoomType" NOT NULL DEFAULT 'GALLERY',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "floor" INTEGER NOT NULL DEFAULT 0,
    "isEntryRoom" BOOLEAN NOT NULL DEFAULT false,
    "wallColor" TEXT NOT NULL DEFAULT '#ece7db',
    "floorColor" TEXT NOT NULL DEFAULT '#c9c0ad',
    "ceilingColor" TEXT NOT NULL DEFAULT '#f4f2ec',
    "wallTexture" TEXT,
    "floorTexture" TEXT,
    "ceilingTexture" TEXT,
    "splashIcon" TEXT,
    "splashTitle" TEXT,
    "splashEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MuseumRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuseumSceneObject" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'custom',
    "label" TEXT,
    "modelUrl" TEXT,
    "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionZ" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rotationY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scale" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "solid" BOOLEAN NOT NULL DEFAULT false,
    "colliderRadius" DOUBLE PRECISION,
    "colliderOffsetX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "colliderOffsetZ" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "colliderHeight" DOUBLE PRECISION,
    "colliderBaseY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MuseumSceneObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuseumRoomArtwork" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "positionX" DOUBLE PRECISION,
    "positionY" DOUBLE PRECISION,
    "positionZ" DOUBLE PRECISION,
    "rotationY" DOUBLE PRECISION,
    "scale" DOUBLE PRECISION,

    CONSTRAINT "MuseumRoomArtwork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuseumRoomStory" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "positionX" DOUBLE PRECISION,
    "positionY" DOUBLE PRECISION,
    "positionZ" DOUBLE PRECISION,
    "rotationY" DOUBLE PRECISION,
    "scale" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MuseumRoomStory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuseumRoomMiniGame" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "displayMode" TEXT,
    "positionX" DOUBLE PRECISION,
    "positionY" DOUBLE PRECISION,
    "positionZ" DOUBLE PRECISION,
    "rotationY" DOUBLE PRECISION,
    "scale" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MuseumRoomMiniGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuseumRoomCosplay" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "cosplayId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "positionX" DOUBLE PRECISION,
    "positionY" DOUBLE PRECISION,
    "positionZ" DOUBLE PRECISION,
    "rotationY" DOUBLE PRECISION,
    "scale" DOUBLE PRECISION,
    "lightsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MuseumRoomCosplay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 1,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "total" DOUBLE PRECISION NOT NULL,
    "paymentId" TEXT,
    "paymongoRef" TEXT,
    "checkoutUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deliveryNotes" TEXT,
    "shippingAddress" TEXT,
    "shippingPhone" TEXT,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "variantId" TEXT,
    "variantLabel" TEXT,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faq" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "venueName" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "eventDate" TIMESTAMP(3),
    "isNextEvent" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventMedia" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "EventMediaType" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarqueeAnnouncement" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "linkUrl" TEXT,
    "textColor" TEXT NOT NULL DEFAULT '#FAF8F3',
    "backgroundColor" TEXT NOT NULL DEFAULT '#0D0D0D',
    "fontSize" TEXT NOT NULL DEFAULT '0.875rem',
    "fontFamily" TEXT NOT NULL DEFAULT 'var(--font-dm-sans), system-ui, sans-serif',
    "speed" INTEGER NOT NULL DEFAULT 24,
    "separator" TEXT NOT NULL DEFAULT '✦',
    "pauseOnHover" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MarqueeAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiniGame" (
    "id" TEXT NOT NULL,
    "type" "MiniGameType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "difficulty" "MiniGameDifficulty" NOT NULL DEFAULT 'MEDIUM',
    "artworkId" TEXT,
    "secondaryArtworkId" TEXT,
    "timeLimitSec" INTEGER NOT NULL DEFAULT 0,
    "scoreMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "leaderboardEnabled" BOOLEAN NOT NULL DEFAULT true,
    "leaderboardSize" INTEGER NOT NULL DEFAULT 10,
    "rewardEnabled" BOOLEAN NOT NULL DEFAULT false,
    "rewardThreshold" INTEGER NOT NULL DEFAULT 0,
    "rewardDescription" TEXT,
    "rewardRequireEmail" BOOLEAN NOT NULL DEFAULT true,
    "differences" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiniGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiniGameSession" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "type" "MiniGameType" NOT NULL,
    "difficulty" "MiniGameDifficulty" NOT NULL,
    "playerId" TEXT NOT NULL,
    "artworkId" TEXT,
    "challenge" JSONB NOT NULL,
    "status" "MiniGameSessionStatus" NOT NULL DEFAULT 'CREATED',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "score" INTEGER,
    "moves" INTEGER,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MiniGameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardEntry" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "type" "MiniGameType" NOT NULL,
    "sessionId" TEXT NOT NULL,
    "artworkId" TEXT,
    "playerId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "completionTime" INTEGER NOT NULL,
    "moves" INTEGER NOT NULL,
    "difficulty" "MiniGameDifficulty" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardClaim" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "threshold" INTEGER NOT NULL,
    "reward" TEXT NOT NULL,
    "artworkTitle" TEXT,
    "status" "RewardClaimStatus" NOT NULL DEFAULT 'PENDING',
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "isSpam" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedEmail" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "category" "ActivityCategory" NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "actorId" TEXT,
    "actorLabel" TEXT,
    "actorEmail" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'system',
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "imageUrl" TEXT,
    "linkUrl" TEXT,
    "linkLabel" TEXT DEFAULT 'Click here to check more info',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteVisitCounter" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteVisitCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitorMilestone" (
    "id" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "reward" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "achievedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitorMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitorMilestoneClaim" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitorMilestoneClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuseumAchievement" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "reward" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MuseumAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuseumAchievementClaim" (
    "id" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "displayName" TEXT,
    "email" TEXT NOT NULL,
    "reportedValue" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MuseumAchievementClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreedomWallSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "activeEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreedomWallSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreedomWallEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreedomWallEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreedomWallNote" (
    "id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL DEFAULT 'Anonymous',
    "content" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT 'yellow',
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scale" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "wall" TEXT NOT NULL DEFAULT 'north',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreedomWallNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "ReleaseNote_isPublished_publishedAt_idx" ON "ReleaseNote"("isPublished", "publishedAt");

-- CreateIndex
CREATE INDEX "ReleaseNote_deletedAt_idx" ON "ReleaseNote"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SoundEffect_key_key" ON "SoundEffect"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Section_slug_key" ON "Section"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Artwork_slug_key" ON "Artwork"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Story_slug_key" ON "Story"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Cosplay_slug_key" ON "Cosplay"("slug");

-- CreateIndex
CREATE INDEX "StoryPage_storyId_pageNumber_idx" ON "StoryPage"("storyId", "pageNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MuseumRoom_slug_key" ON "MuseumRoom"("slug");

-- CreateIndex
CREATE INDEX "MuseumRoom_museumId_idx" ON "MuseumRoom"("museumId");

-- CreateIndex
CREATE INDEX "MuseumSceneObject_roomId_idx" ON "MuseumSceneObject"("roomId");

-- CreateIndex
CREATE INDEX "MuseumRoomArtwork_roomId_idx" ON "MuseumRoomArtwork"("roomId");

-- CreateIndex
CREATE INDEX "MuseumRoomArtwork_artworkId_idx" ON "MuseumRoomArtwork"("artworkId");

-- CreateIndex
CREATE UNIQUE INDEX "MuseumRoomArtwork_roomId_artworkId_key" ON "MuseumRoomArtwork"("roomId", "artworkId");

-- CreateIndex
CREATE INDEX "MuseumRoomStory_roomId_idx" ON "MuseumRoomStory"("roomId");

-- CreateIndex
CREATE INDEX "MuseumRoomStory_storyId_idx" ON "MuseumRoomStory"("storyId");

-- CreateIndex
CREATE UNIQUE INDEX "MuseumRoomStory_roomId_storyId_key" ON "MuseumRoomStory"("roomId", "storyId");

-- CreateIndex
CREATE INDEX "MuseumRoomMiniGame_roomId_idx" ON "MuseumRoomMiniGame"("roomId");

-- CreateIndex
CREATE INDEX "MuseumRoomMiniGame_gameId_idx" ON "MuseumRoomMiniGame"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "MuseumRoomMiniGame_roomId_gameId_key" ON "MuseumRoomMiniGame"("roomId", "gameId");

-- CreateIndex
CREATE INDEX "MuseumRoomCosplay_roomId_idx" ON "MuseumRoomCosplay"("roomId");

-- CreateIndex
CREATE INDEX "MuseumRoomCosplay_cosplayId_idx" ON "MuseumRoomCosplay"("cosplayId");

-- CreateIndex
CREATE UNIQUE INDEX "MuseumRoomCosplay_roomId_cosplayId_key" ON "MuseumRoomCosplay"("roomId", "cosplayId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_artworkId_key" ON "Product"("artworkId");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- CreateIndex
CREATE INDEX "Order_customerEmail_idx" ON "Order"("customerEmail");

-- CreateIndex
CREATE INDEX "Order_archivedAt_idx" ON "Order"("archivedAt");

-- CreateIndex
CREATE INDEX "Event_deletedAt_idx" ON "Event"("deletedAt");

-- CreateIndex
CREATE INDEX "Event_isNextEvent_idx" ON "Event"("isNextEvent");

-- CreateIndex
CREATE INDEX "EventMedia_eventId_idx" ON "EventMedia"("eventId");

-- CreateIndex
CREATE INDEX "MarqueeAnnouncement_deletedAt_isActive_priority_idx" ON "MarqueeAnnouncement"("deletedAt", "isActive", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "MiniGame_type_key" ON "MiniGame"("type");

-- CreateIndex
CREATE INDEX "MiniGameSession_gameId_status_idx" ON "MiniGameSession"("gameId", "status");

-- CreateIndex
CREATE INDEX "MiniGameSession_playerId_createdAt_idx" ON "MiniGameSession"("playerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardEntry_sessionId_key" ON "LeaderboardEntry"("sessionId");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_gameId_score_idx" ON "LeaderboardEntry"("gameId", "score");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_type_artworkId_score_idx" ON "LeaderboardEntry"("type", "artworkId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "RewardClaim_sessionId_key" ON "RewardClaim"("sessionId");

-- CreateIndex
CREATE INDEX "RewardClaim_status_createdAt_idx" ON "RewardClaim"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_readAt_createdAt_idx" ON "Notification"("readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_deletedAt_idx" ON "Notification"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedEmail_email_key" ON "BlockedEmail"("email");

-- CreateIndex
CREATE INDEX "ActivityLog_category_createdAt_idx" ON "ActivityLog"("category", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_actorId_createdAt_idx" ON "ActivityLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "VisitorMilestone_threshold_key" ON "VisitorMilestone"("threshold");

-- CreateIndex
CREATE UNIQUE INDEX "VisitorMilestoneClaim_milestoneId_email_key" ON "VisitorMilestoneClaim"("milestoneId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "MuseumAchievement_category_threshold_key" ON "MuseumAchievement"("category", "threshold");

-- CreateIndex
CREATE UNIQUE INDEX "MuseumAchievementClaim_achievementId_email_key" ON "MuseumAchievementClaim"("achievementId", "email");

-- CreateIndex
CREATE INDEX "FreedomWallEvent_deletedAt_idx" ON "FreedomWallEvent"("deletedAt");

-- CreateIndex
CREATE INDEX "FreedomWallNote_eventId_isArchived_createdAt_idx" ON "FreedomWallNote"("eventId", "isArchived", "createdAt");

-- CreateIndex
CREATE INDEX "FreedomWallNote_deletedAt_idx" ON "FreedomWallNote"("deletedAt");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artwork" ADD CONSTRAINT "Artwork_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryPage" ADD CONSTRAINT "StoryPage_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MuseumRoom" ADD CONSTRAINT "MuseumRoom_museumId_fkey" FOREIGN KEY ("museumId") REFERENCES "DigitalMuseum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MuseumSceneObject" ADD CONSTRAINT "MuseumSceneObject_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "MuseumRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MuseumRoomArtwork" ADD CONSTRAINT "MuseumRoomArtwork_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "MuseumRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MuseumRoomArtwork" ADD CONSTRAINT "MuseumRoomArtwork_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MuseumRoomStory" ADD CONSTRAINT "MuseumRoomStory_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "MuseumRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MuseumRoomStory" ADD CONSTRAINT "MuseumRoomStory_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MuseumRoomMiniGame" ADD CONSTRAINT "MuseumRoomMiniGame_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "MuseumRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MuseumRoomMiniGame" ADD CONSTRAINT "MuseumRoomMiniGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "MiniGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MuseumRoomCosplay" ADD CONSTRAINT "MuseumRoomCosplay_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "MuseumRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MuseumRoomCosplay" ADD CONSTRAINT "MuseumRoomCosplay_cosplayId_fkey" FOREIGN KEY ("cosplayId") REFERENCES "Cosplay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMedia" ADD CONSTRAINT "EventMedia_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiniGame" ADD CONSTRAINT "MiniGame_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiniGame" ADD CONSTRAINT "MiniGame_secondaryArtworkId_fkey" FOREIGN KEY ("secondaryArtworkId") REFERENCES "Artwork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiniGameSession" ADD CONSTRAINT "MiniGameSession_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "MiniGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "MiniGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MiniGameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardClaim" ADD CONSTRAINT "RewardClaim_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "MiniGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardClaim" ADD CONSTRAINT "RewardClaim_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MiniGameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorMilestoneClaim" ADD CONSTRAINT "VisitorMilestoneClaim_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "VisitorMilestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MuseumAchievementClaim" ADD CONSTRAINT "MuseumAchievementClaim_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "MuseumAchievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreedomWallSettings" ADD CONSTRAINT "FreedomWallSettings_activeEventId_fkey" FOREIGN KEY ("activeEventId") REFERENCES "FreedomWallEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreedomWallNote" ADD CONSTRAINT "FreedomWallNote_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "FreedomWallEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
