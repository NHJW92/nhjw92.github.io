// Rewrites markdown image URLs that start with /uploads/ (as written by Pages CMS)
// into paths relative to the post file, so Astro picks them up and optimises them.
import path from 'node:path';

export function remarkUploads() {
  return (tree, file) => {
    const fileDir = file.dirname ?? (file.path ? path.dirname(file.path) : null);
    if (!fileDir) return;
    const uploadsDir = path.resolve(file.cwd ?? process.cwd(), 'src/assets/uploads');
    const visit = (node) => {
      if (node.type === 'image' && typeof node.url === 'string' && node.url.startsWith('/uploads/')) {
        const target = path.join(uploadsDir, decodeURIComponent(node.url.slice('/uploads/'.length)));
        let rel = path.relative(fileDir, target).split(path.sep).join('/');
        if (!rel.startsWith('.')) rel = './' + rel;
        node.url = rel;
      }
      if (node.children) node.children.forEach(visit);
    };
    visit(tree);
  };
}
