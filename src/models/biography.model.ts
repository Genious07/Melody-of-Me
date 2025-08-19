import mongoose, { Schema, model, Document, Model, models } from 'mongoose';

export interface IBiography extends Document {
    userId: string; 
    shareId: string;
    content: string;
    eras: object[]; 
    createdAt: Date;
}

const biographySchema = new Schema<IBiography>({
    userId: { type: String, required: true, index: true },
    shareId: { type: String, required: true, unique: true, index: true },
    content: { type: String, required: true },
    eras: { type: Array, required: true },
    createdAt: { type: Date, default: Date.now, expires: '30d' }, 
});

const Biography: Model<IBiography> = models.Biography || model<IBiography>('Biography', biographySchema);

export default Biography;
