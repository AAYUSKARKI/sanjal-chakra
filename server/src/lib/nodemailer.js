import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({

    host: "smtp.ethereal.email",
    port: 587,
    auth: {
        user: process.env.SMPT_USER,
        pass: process.env.SMPT_PASSWORD,

    }
});

const sendOtp = async (email, otp) => {
    const mailOptions = {
        from: process.env.SMPT_USER,
        to: email,
        subject: "OTP Verification",
        text: `Your OTP is: ${otp}`
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent:", info.response);
    } catch (error) {
        console.error("Error sending email:", error);
    }
}


export default sendOtp