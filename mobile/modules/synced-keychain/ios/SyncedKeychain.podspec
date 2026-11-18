Pod::Spec.new do |s|
  s.name           = 'SyncedKeychain'
  s.version        = '1.0.0'
  s.summary        = 'Small values in the iCloud-synced keychain'
  s.description    = 'Stores small values in the keychain with iCloud sync on, for the cloud backup key.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
