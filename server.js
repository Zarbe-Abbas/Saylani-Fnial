require('dotenv').config();
const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// Configure nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Generate Registration Number
function generateRegistrationNumber() {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `SAY${year}${random}`;
}

// Generate PDF ID Card
async function generateIDCard(studentData) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: [350, 500],
            margins: {
                top: 20,
                bottom: 20,
                left: 30,
                right: 30
            }
        });

        // Create temp directory if it doesn't exist
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        const registrationNumber = generateRegistrationNumber();
        const filePath = path.join(tempDir, `${registrationNumber}.pdf`);
        const writeStream = fs.createWriteStream(filePath);

        doc.pipe(writeStream);

        // Add logo
        // doc.image('path_to_logo.png', 125, 20, { width: 100 });

        // Header
        doc.fontSize(16)
           .fillColor('#8DC63F')
           .text('SAYLANI MASS IT TRAINING', { align: 'center' });

        doc.moveDown();
        doc.fontSize(14)
           .fillColor('#333')
           .text('STUDENT ID CARD', { align: 'center' });

        // Student Details
        doc.moveDown(2);
        doc.fontSize(12)
           .fillColor('#333');

        const details = [
            ['Registration No:', registrationNumber],
            ['Name:', studentData.fullName],
            ['CNIC:', studentData.cnic],
            ['Program:', studentData.program],
            ['Contact:', studentData.phone],
            ['Email:', studentData.email]
        ];

        details.forEach(([label, value]) => {
            doc.text(`${label} ${value}`, {
                paragraphGap: 10
            });
            doc.moveDown(0.5);
        });

        // Add QR Code placeholder
        doc.rect(125, 350, 100, 100).stroke();
        doc.fontSize(8)
           .text('QR Code', 125, 400, { width: 100, align: 'center' });

        doc.end();

        writeStream.on('finish', () => resolve({ filePath, registrationNumber }));
        writeStream.on('error', reject);
    });
}

// Registration endpoint
app.post('/register', async (req, res) => {
    try {
        // Generate ID Card
        const { filePath, registrationNumber } = await generateIDCard(req.body);

        // Send email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: req.body.email,
            subject: 'Saylani Registration Confirmation',
            text: `Dear ${req.body.fullName},\n\nThank you for registering with Saylani Mass IT Training Program.\nYour registration number is: ${registrationNumber}\n\nPlease find your ID card attached.\n\nBest regards,\nSaylani Team`,
            attachments: [{
                filename: 'id_card.pdf',
                path: filePath
            }]
        };

        await transporter.sendMail(mailOptions);

        // Clean up temporary file
        fs.unlinkSync(filePath);

        res.json({
            success: true,
            message: 'Registration successful',
            registrationNumber
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed',
            error: error.message
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 