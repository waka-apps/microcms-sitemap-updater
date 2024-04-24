import { format } from "@formkit/tempo";
import * as dotenv from "dotenv";
import { createWriteStream } from "fs";
import { createClient } from "microcms-js-sdk";
import process from "process";
import { SitemapStream, streamToPromise } from "sitemap";

if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

export const client = createClient({
  serviceDomain: process.env.MICROCMS_SERVER_DOMAIN,
  apiKey: process.env.MICROCMS_API_KEY,
});

const getCategories = async () => {
  const data = await client.getList({
    endpoint: "categories",
  });
  return data.contents;
};

const getPosts = async () => {
  const limit = 20;
  let results = [];
  let offset = 0;
  let hasNext = true;

  while (hasNext) {
    const data = await client.getList({
      endpoint: "blog",
      queries: {
        orders: "-updatedAt",
        offset: offset,
        limit: limit,
      },
    });
    results = results.concat(data.contents);
    hasNext = data.totalCount > offset;
    offset += limit;
  }

  return results;
};

const createSitemap = async () => {
  console.log(`Start generating sitemap.`);
  const sitemapStream = new SitemapStream({
    hostname: process.env.MY_HOST_NAME,
    encoding: "UTF-8",
    xmlns: {
      xhtml: "http://www.w3.org/1999/xhtml",
    },
  });

  console.log(`Start getting categories.`);
  const categories = await getCategories();
  categories.map((category) => {
    category.updatedAt;
    const route = { url: `/categories/${category.id}`, changefreq: "monthly", priority: 0.5 };
    sitemapStream.write(route);
  });
  console.log(`End getting categories.`);

  console.log(`Start getting posts.`);
  const posts = await getPosts();
  posts.map((post) => {
    post.updatedAt;
    const route = { url: `/posts/${post.id}`, changefreq: "monthly", priority: 0.8 };
    sitemapStream.write(route);
  });
  console.log(`End getting posts.`);

  const lastmod = posts.length > 0 ? posts[0].updatedAt : format(new Date(), "YYYY-MM-DDThh:mm:ssZ");

  sitemapStream.write({ url: "/", changefreq: "daily", priority: 1.0, lastmod: lastmod });
  sitemapStream.write({ url: "/about", changefreq: "monthly", priority: 0.5 });

  // sitemapの生成を終了します
  sitemapStream.end();

  console.log(`Start writting sitemap.xml.`);
  // sitemapをXML形式に変換し、ファイルに書き込みます
  streamToPromise(sitemapStream).then((sitemap) => {
    createWriteStream("public/sitemap.xml").write(sitemap);
  });
  console.log(`End writting sitemap.xml.`);
  console.log(`End generating sitemap.`);
};
createSitemap();
