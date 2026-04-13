const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Fixing legacy domain in post contents...');
  
  const badPosts = await prisma.post.findMany({
    where: {
      OR: [
        { contentHtml: { contains: 'blog.thienduong.info' } },
        { content: { contains: 'blog.thienduong.info' } },
        { contentHtml: { contains: 'api.thienduong.info' } },
        { content: { contains: 'api.thienduong.info' } }
      ]
    }
  });
  
  if (badPosts.length > 0) {
    console.log(`Found ${badPosts.length} posts with old domain. Updating...`);
    
    for (const p of badPosts) {
      let newHtml = p.contentHtml;
      let newContent = p.content;
      
      if (newHtml) {
        newHtml = newHtml.replace(/blog\.thienduong\.info/g, 'dailydevops.blog');
        newHtml = newHtml.replace(/api\.thienduong\.info/g, 'api.dailydevops.blog');
      }
      
      if (newContent) {
        newContent = newContent.replace(/blog\.thienduong\.info/g, 'dailydevops.blog');
        newContent = newContent.replace(/api\.thienduong\.info/g, 'api.dailydevops.blog');
      }
      
      await prisma.post.update({
        where: { id: p.id },
        data: {
          contentHtml: newHtml,
          content: newContent
        }
      });
      console.log(`- Updated: ${p.title}`);
    }
  } else {
    console.log('No posts found with thienduong.info in content.');
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
