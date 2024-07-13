{
  "targets": [
    {
      "target_name": "engine",
      "sources": [ "engine.cc" ],
      "include_dirs": [
        "<!(node -e \"require('nan')\")"
      ]
    }
  ]
}