var fs = require("fs");
var path = require("path");
const md5File = require("md5-file");
const https = require("https");
var extract = require("extract-zip");

function getMD5Digest(file) {
    const hash = md5File.sync(file);
    return hash.toUpperCase();
}

var outputFileName = "charting_library.29.4.0.zip";
var outputFilePath = path.join(__dirname, outputFileName);
// Where the archive comes from. CHARTING_LIBRARY_URL points the download at a mirror (the md5
// next to this file is still checked, so a mirror cannot change what is installed).
var downloadUrl =
    process.env.CHARTING_LIBRARY_URL || "https://blocksights.info/" + outputFileName;

function fail(message, err) {
    console.error("Charting library: " + message);
    if (err) console.error(err.message || err);
    console.error(
        "The archive is " + outputFileName + ", expected md5 " + readExpectedDigest() +
            ". Put it into " + __dirname + " yourself, or set CHARTING_LIBRARY_URL to a mirror."
    );
    process.exit(1);
}

function readExpectedDigest() {
    return fs.readFileSync(outputFilePath + ".md5").toString().trim();
}

// GET with redirects. Anything but a 200 is an error that names the address and the answer; before
// this a refused or redirected download was written to the zip and showed up as an md5 mismatch.
function download(url, redirectsLeft, done) {
    https
        .get(url, function(response) {
            var status = response.statusCode;
            if (status >= 300 && status < 400 && response.headers.location && redirectsLeft > 0) {
                response.resume();
                return download(new URL(response.headers.location, url).href, redirectsLeft - 1, done);
            }
            if (status !== 200) {
                response.resume();
                return done(new Error("HTTP " + status + " from " + url));
            }
            // the file is only created once the answer is a 200, so a failed download leaves nothing behind
            var outputFile = fs.createWriteStream(outputFilePath);
            response.pipe(outputFile);
            outputFile.on("finish", function() {
                done(null);
            });
            outputFile.on("error", done);
        })
        .on("error", done);
}

// download only if it doesnt exist
if (!fs.existsSync(outputFilePath)) {
    download(downloadUrl, 5, function(err) {
        if (err) {
            if (fs.existsSync(outputFilePath)) fs.unlinkSync(outputFilePath);
            return fail("failed to download the archive from " + downloadUrl, err);
        }
        checkDigest();
    });
} else {
    checkDigest();
}

function checkDigest() {
    const actualDigest = getMD5Digest(outputFilePath);
    const expectedDigest = readExpectedDigest();
    if (actualDigest !== expectedDigest) {
        fs.unlinkSync(outputFilePath);
        return fail(
            "MD5 of the downloaded file (" + actualDigest + ") does not match the expected " + expectedDigest +
                " (the download from " + downloadUrl + " was not the archive: a proxy or firewall page?)"
        );
    }
    console.log("MD5 digest validated, extracting library...");
    extract(outputFilePath, {dir: __dirname}, function(err) {
        if (err) {
            console.error("Decompress error!", err);
        }
    });
}
