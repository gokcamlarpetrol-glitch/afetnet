# AfetNet Documentation

## GitHub Pages Setup

These files MUST be accessible via HTTPS for Apple & Google app store submission.

### URLs:
- Privacy Policy: https://gokhancamci.github.io/AfetNet1/docs/privacy-policy.html
- Terms of Service: https://gokhancamci.github.io/AfetNet1/docs/terms-of-service.html

### How to Enable GitHub Pages:

1. Go to GitHub repository settings
2. Navigate to "Pages" section
3. Source: Deploy from branch `main`
4. Folder: `/docs`
5. Click "Save"
6. Wait 1-2 minutes for deployment
7. Verify URLs are accessible

### Testing URLs:

```bash
curl -I https://gokhancamci.github.io/AfetNet1/docs/privacy-policy.html
curl -I https://gokhancamci.github.io/AfetNet1/docs/terms-of-service.html
```

Both should return `200 OK`

### Important:
- These URLs are referenced in `app.config.ts`
- Apple & Google will check these URLs during review
- 404 = Automatic rejection!
