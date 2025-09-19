import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({

    host: "smtp.ethereal.email",
    port: 587,
    auth: {
        user: process.env.SMPT_USER,
        pass: process.env.SMPT_PASSWORD,

    }


});


export default transporter;