# yackage

Package your Node.js project into an executable.

This project is targeted for apps built with [Yue library][yue] and
[Yode Node.js runtime][yode].

## Install

```
npm i -g yackage
```

## Usage

```
Usage: yackage [options] [command]

Options:

  --platform <platform>     Target platform
  --arch <arch>             Target arch
  --yode-version <version>  Yode version
  --app-dir <dir>           Path to the app
  --cache-dir <dir>         Directory to store downloaded binaries

Commands:

  build <outputDir>         Build exetutable file from app
  dist <outputDir>          Build and create distribution
  start                     Run app with Yode
```

Note that by default yackage would download Yode binaries into the `yode/`
directory under the app's directory, make sure `yode/` is added to `.gitignore`
otherwise it would be included in the final executable. Or you can explicitly
pass `--cache-dir` to specify the place to sotre downloaded Yode binaries.

## Examples

Generate executable from the app under current working directory:

```sh
cd /path/to/app/
yackage build out
ls out
```

Generate executable from path under arbitrary path:

```
yackage build out --app-dir /path/to/app
```

Generate executable for arbitrary platform:

```
yackage build out --platform win32 --arch ia32
```

Generate distributions:

```
yackage dist out --app-dir /path/to/app
```

## Configuration

Configure your project by adding following fields to `package.json`:

```json
{
  "build": {
    "appId": "com.app.id"
    "productName": "App"
    "copyright": "Copyright © 2020 Company",
    "unpack": "+(*.node|*.html|*.png|*.gif)"
  }
}
```

## How yackage works

1. Run `npm pack` to generate tarball for the app.
2. Extract the tarball to temporary directory and run `npm install`.
3. Use `asar` to pacakge the app and its dependencies.
4. Append the generated ASAR archive to Yode.
5. Yode would automatically recognize the ASAR archive appended in the
   executable and start with it.

### Differences from packaging in Electron

By default yackage would unpack the `.node` files so they are not extracted
dynamically when running, otherwise anti-virus softwares would complain.

The unpacked files are placed in the `res` directory instead of the usual
`.unpacked` directory, so the final distribution would look more formal.

The `.js` files are compressed with `uglify-es` by default.

The virutal root directory of ASAR archive is `${process.execPath}/asar`. Using
`process.execPath` as virutal root directory directly would confuse Node.js
since it should be a file.

## License

Public domain.

[yue]: https://github.com/yue/yue
[yode]: https://github.com/yue/yode
[electron-builder]: https://www.electron.build/configuration/configuration
