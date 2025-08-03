echo '# fnm
FNM_PATH="/usr/local/fnm"
if [ -d "$FNM_PATH" ]; then
  export PATH="$FNM_PATH:$PATH"
  eval "`fnm env`"
fi' >> ~/.bashrc
