/**
 * Prisma seed — catégories de menu par défaut.
 *
 * Utilisation :
 *   pnpm --filter api prisma:seed
 *
 * Idempotent : crée les catégories uniquement pour les tenants qui n'en ont pas encore.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES = [
  { name: 'ENTREE', displayOrder: 1 },
  { name: 'MAIN', displayOrder: 2 },
  { name: 'DESSERT', displayOrder: 3 },
  { name: 'DRINK', displayOrder: 4 },
  { name: 'SIDE', displayOrder: 5 },
] as const;

async function main() {
  // Tous les tenants actifs
  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });

  console.log(`Tenants trouvés : ${tenants.length}`);

  for (const tenant of tenants) {
    const existing = await prisma.menuCategory.count({
      where: { tenantId: tenant.id, deletedAt: null },
    });

    if (existing > 0) {
      console.log(`  ✓ ${tenant.name} — ${existing} catégorie(s) existante(s), ignoré`);
      continue;
    }

    await prisma.menuCategory.createMany({
      data: DEFAULT_CATEGORIES.map((cat) => ({
        ...cat,
        tenantId: tenant.id,
      })),
    });

    console.log(`  ✅ ${tenant.name} — ${DEFAULT_CATEGORIES.length} catégories créées`);
  }
}

main()
  .catch((err: unknown) => {
    console.error('Seed échoué :', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
