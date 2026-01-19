import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Delete all attendance records for today
    const deleteResult = await prisma.attendance.deleteMany({
        where: {
            createdAt: {
                gte: today,
                lt: tomorrow,
            },
        },
    });

    console.log(`Deleted ${deleteResult.count} attendance records for today.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
