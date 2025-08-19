import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import Biography from '@/models/biography.model';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: { shareId: string } }
) {
  const { shareId } = params;

  if (!shareId) {
    return NextResponse.json({ error: 'Share ID is required' }, { status: 400 });
  }

  try {
    await clientPromise;

    const bio = await Biography.findOne({ shareId }).lean();

    if (!bio) {
      return NextResponse.json({ error: 'Biography not found' }, { status: 404 });
    }

    return NextResponse.json(bio);
  } catch (error) {
    console.error('Failed to fetch biography:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
