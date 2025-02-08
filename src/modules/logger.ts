import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file"; // Import the daily rotate transport
import fs from "fs";
import path from "path";

// Ensure logs directory exists
const logDir = path.join(__dirname, "logs");

if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}


// Define log format
const logFormat = winston.format.printf(({ level, message, timestamp }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${message}`;
});

// Create Winston logger
const logger = winston.createLogger({
    level: "info", // Default log level
    format: winston.format.combine(
        winston.format.timestamp(),
        logFormat
    ),
    transports: [
        new winston.transports.Console(), // Log to console
        
        // Log to rotating files
        new DailyRotateFile({
            filename: "logs/app-%DATE%.log", // Filename format with date
            datePattern: "YYYY-MM-DD", // Rotate daily
            maxSize: "20m", // Max file size before rotation (20 MB)
            maxFiles: "3d", // Keep logs for the last 3 days
            zippedArchive: true, // Compress older logs
            format: winston.format.combine(
                winston.format.timestamp(),
                logFormat
            ),
        })
    ]
});

export default logger;
