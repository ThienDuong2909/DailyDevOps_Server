const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Searching seo_settings for legacy domain...');
  
  const badSettings = await prisma.seoSetting.findMany({
    where: {
      canonicalUrl: {
        contains: 'thienduong.info'
      }
    }
  });
  
  if (badSettings.length > 0) {
    console.log(`Found ${badSettings.length} SEO settings with old canonical URL.`);
    
    for (const s of badSettings) {
        if (!s.canonicalUrl) continue;
        const newUrl = s.canonicalUrl.replace('blog.thienduong.info', 'dailydevops.blog').replace('thienduong.info', 'dailydevops.blog');
        console.log(`Updating ${s.canonicalUrl} -> ${newUrl}`);
        await prisma.seoSetting.update({
            where: { id: s.id },
            data: { canonicalUrl: newUrl }
        });
    }
    console.log('Update complete.');
  } else {
    console.log('No SEO settings found with thienduong.info in canonicalUrl.');
  }

  console.log('Checking if any SystemSettings have legacy domain...');
  const badSysSettings = await prisma.systemSetting.findMany({
    where: {
      value: {
        contains: 'thienduong.info'
      }
    }
  });

  if (badSysSettings.length > 0) {
      console.log(`Found ${badSysSettings.length} system settings with old domain.`);
      for (const s of badSysSettings) {
          console.log(`System setting ${s.key} has value: ${s.value}`);
          // Update it
          if (s.key === 'site_url' || s.key.includes('url')) {
            const newVal = s.value.replace('blog.thienduong.info', 'dailydevops.blog').replace('thienduong.info', 'dailydevops.blog');
            await prisma.systemSetting.update({
                where: { id: s.id },
                data: { value: newVal }
            });
            console.log(`Updated sys setting ${s.key} -> ${newVal}`);
          }
      }
  } else {
      console.log('No SystemSettings found with thienduong.info.');
  }

}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
