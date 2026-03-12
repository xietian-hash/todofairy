const tagRepo = require("../repositories/tag-repository");

async function listTagOptions(userId) {
  const tags = await tagRepo.listTagsByUser(userId);
  const sorted = [...tags].sort((a, b) => {
    const bySort = (Number(a.sort) || 0) - (Number(b.sort) || 0);
    if (bySort !== 0) {
      return bySort;
    }
    return (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0);
  });
  return {
    list: sorted
      .filter((tag) => tag && (tag.name || tag.tagName))
      .map((tag) => ({
      tagId: tag._id,
      tagName: tag.name || tag.tagName,
      sort: Number(tag.sort) || 0,
      })),
  };
}

module.exports = {
  listTagOptions,
};
