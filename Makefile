SHELL := /bin/bash

.PHONY: icons clean archive all

icons:
	python3 tools/generate_appicon.py

clean:
	rm -rf ios/build
	rm -rf ~/Library/Developer/Xcode/DerivedData/*

archive:
	xcodebuild -workspace ios/AfetNet.xcworkspace -scheme AfetNet -configuration Release -destination 'generic/platform=iOS' archive -archivePath /tmp/AfetNet.xcarchive

prepush:
	@echo "Running pre-push checks..."
	npm run lint
	npm run typecheck
	npm run test -- --ci --watchAll=false
	@echo "✅ Pre-push checks passed!"

all: clean icons archive























