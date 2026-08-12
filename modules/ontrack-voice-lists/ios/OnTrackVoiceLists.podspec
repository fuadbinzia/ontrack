Pod::Spec.new do |s|
  s.name           = 'OnTrackVoiceLists'
  s.version        = '1.0.0'
  s.summary        = 'Siri and Assistant bridge for onTrack checklists'
  s.description    = 'Persists a voice snapshot and pending add-ops for Siri and Google Assistant.'
  s.author         = 'onTrack'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '*.swift'
end
