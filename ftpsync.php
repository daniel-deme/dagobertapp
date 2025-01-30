$path = $_POST['root'].$_POST['path'].$_POST['name'];
$folders = explode("/", $_POST['path']);
$createdfolder = "";
foreach ($folders as $folder) {
  $createdfolder.=$folder."/";
  if(!file_exists($_POST['root'].$createdfolder)){
    mkdir($_POST['root'].$createdfolder, 0777, true);
  }
}
if(file_exists($path)){
  chmod($path,0755); 
  unlink($path);
}
echo file_put_contents($path, urldecode($_POST['plain'])) ? 1 : 0;
//not visual studio code ->
//echo (move_uploaded_file($_FILES["file"]["tmp_name"], $path) !== false) ? 1 : 0;