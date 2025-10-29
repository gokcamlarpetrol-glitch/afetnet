SHELL := /bin/bash

.PHONY: icons clean archive all

icons:
	python3 tools/generate_appicon.py

clean:
	rm -rf ios/build
	rm -rf ~/Library/Developer/Xcode/DerivedData/*

archive:
	xcodebuild -workspace ios/AfetNet.xcworkspace -scheme AfetNet -configuration Release -destination 'generic/platform=iOS' archive -archivePath /tmp/AfetNet.xcarchive

all: clean icons archive



















