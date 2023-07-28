To release a new version of `p0tion`, the following steps can be taken:

> you have to replace version number 1.2.3 with the version number you are planning to release

1. Verify that tests have passed on GitHub Actions

2. Clone `p0tion`:

```
git clone https://github.com/privacy-scaling-explorations/p0tion.git
```

3. Install required dependencies:

```
yarn install --immutable
```

4. Install required global dependencies:

```
npm install -g lerna
npm install -g conventional-changelog-conventionalcommits
```

5. Run `lerna version` to update CHANGELOG and version numbers of sub-packages:

```
npx lerna version --no-push --no-git-tag-version --conventional-commits 1.2.3 --message "chore(release): publish 1.2.3"
```

6. Push changes and create a pull request

7. Merge pull request into main branch

8. Retrieve merged commit from main branch:

```
git pull origin main
```

9. Add a tag:

```
git tag --sign v1.2.3 --message v1.2.3
```

10. Publish tag:

```
git push v1.2.3
```

Once the tag is pushed, GitHub Actions will automatically publish the packages to npm.js[1] and create a release on GitHub.

---

[1]: The following packages will be published on npm.js:

-   @p0tion/actions
-   @p0tion/backend
-   @p0tion/phase2cli
