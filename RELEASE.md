To release a new version of `mpc-phase2-suite`, the following steps can be taken:

> you have to replace version number 1.2.3 with the version number you are planning to release

1. Verify that tests have passed on GitHub Actions

2. Clone `mpc-phase2-suite`:

```
git clone https://github.com/quadratic-funding/mpc-phase2-suite
```

3. Install required dependencies:

```
yarn install
```

4. Run `lerna version` to update CHANGELOG and version numbers of sub-packages:

```
npx lerna version --no-push --no-git-tag-version --conventional-commits 1.2.3
```

5. Commit changes:

```
git commit --message "chore(release): publish 1.2.3"
```

7. Push changes and create a pull request

After the pull request has been merged:


8. Retrieve merged commit

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
* @zkmpc/actions
* @zkmpc/backend
* @zkmpc/phase2cli
